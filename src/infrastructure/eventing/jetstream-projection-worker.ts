/**
 * bead-0773: JetStream projection worker for derived artifacts.
 *
 * Subscribes to NATS JetStream subject `portarium.events.evidence.recorded`
 * and feeds evidence payloads into the DerivedArtifactProjectorService.
 *
 * Delivery guarantee: at-least-once (JetStream pull consumer with ack).
 * Idempotency is enforced by the projector checkpoint stored in Postgres.
 *
 * Usage:
 *   const worker = new JetstreamProjectionWorker({ ...deps });
 *   await worker.start();
 *   // later:
 *   await worker.stop();
 */

import { projectEvidenceBatch } from '../../application/services/derived-artifact-projector.js';
import type {
  DerivedArtifactProjectorDeps,
  EvidencePayload,
  ProjectorConfig,
} from '../../application/services/derived-artifact-projector.js';
import { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { PortariumLogger } from '../observability/logger.js';

// ---------------------------------------------------------------------------
// NATS JetStream consumer interface (minimal — avoids hard nats.ws/nats dep)
// ---------------------------------------------------------------------------

export interface JetstreamMessage {
  /** Parsed JSON payload */
  data: unknown;
  /** Acknowledge successful processing */
  ack(): void;
  /** Negative-acknowledge (re-deliver) */
  nak(): void;
  /** Subject the message was published on */
  subject: string;
}

export interface JetstreamConsumer {
  /**
   * Fetch up to `batch` messages, waiting up to `expires` ms.
   * Resolves with the messages received (0 to `batch`).
   */
  fetch(
    options: Readonly<{ batch: number; expires: number }>,
  ): Promise<readonly JetstreamMessage[]>;
}

// ---------------------------------------------------------------------------
// Worker config and state
// ---------------------------------------------------------------------------

export interface JetstreamProjectionWorkerConfig {
  /** Projector dependencies (ports injected from infra layer) */
  projectorDeps: DerivedArtifactProjectorDeps;
  /** Projector configuration (version, model, etc.) */
  projectorConfig: ProjectorConfig;
  /** JetStream pull consumer bound to the evidence.recorded stream */
  consumer: JetstreamConsumer;
  /** Logger instance */
  logger: PortariumLogger;
  /** How many messages to pull per fetch cycle. Defaults to 10. */
  fetchBatchSize?: number;
  /** Milliseconds to wait for messages in each fetch. Defaults to 2000. */
  fetchExpiresMs?: number;
  /** Milliseconds to pause between fetch cycles when the last batch was empty. Defaults to 500. */
  idlePauseMs?: number;
}

export type WorkerStatus = 'stopped' | 'running' | 'stopping';

function parseEvidencePayload(data: unknown): EvidencePayload | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const d = data as Record<string, unknown>;
  if (
    typeof d['evidenceId'] !== 'string' ||
    typeof d['workspaceId'] !== 'string' ||
    typeof d['runId'] !== 'string' ||
    typeof d['text'] !== 'string' ||
    typeof d['createdAtIso'] !== 'string'
  ) {
    return undefined;
  }
  return {
    evidenceId: EvidenceId(d['evidenceId']),
    workspaceId: WorkspaceId(d['workspaceId']),
    runId: RunId(d['runId']),
    text: d['text'],
    metadata: (d['metadata'] as Record<string, unknown> | undefined) ?? {},
    createdAtIso: d['createdAtIso'],
  };
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export class JetstreamProjectionWorker {
  readonly #deps: DerivedArtifactProjectorDeps;
  readonly #config: ProjectorConfig;
  readonly #consumer: JetstreamConsumer;
  readonly #log: PortariumLogger;
  readonly #fetchBatchSize: number;
  readonly #fetchExpiresMs: number;
  readonly #idlePauseMs: number;

  #status: WorkerStatus = 'stopped';
  #loopPromise: Promise<void> | undefined;

  public constructor(workerConfig: JetstreamProjectionWorkerConfig) {
    this.#deps = workerConfig.projectorDeps;
    this.#config = workerConfig.projectorConfig;
    this.#consumer = workerConfig.consumer;
    this.#log = workerConfig.logger.child({ component: 'jetstream-projection-worker' });
    this.#fetchBatchSize = workerConfig.fetchBatchSize ?? 10;
    this.#fetchExpiresMs = workerConfig.fetchExpiresMs ?? 2000;
    this.#idlePauseMs = workerConfig.idlePauseMs ?? 500;
  }

  public get status(): WorkerStatus {
    return this.#status;
  }

  /** Start the fetch-process loop in the background. */
  public start(): void {
    if (this.#status !== 'stopped') return;
    this.#status = 'running';
    this.#log.info('JetStream projection worker started');
    this.#loopPromise = this.#runLoop();
  }

  /** Signal the loop to stop and wait for the current cycle to complete. */
  public async stop(): Promise<void> {
    if (this.#status !== 'running') return;
    this.#status = 'stopping';
    this.#log.info('JetStream projection worker stopping');
    await this.#loopPromise;
    this.#status = 'stopped';
    this.#log.info('JetStream projection worker stopped');
  }

  async #runLoop(): Promise<void> {
    while (this.#status === 'running') {
      try {
        const messages = await this.#consumer.fetch({
          batch: this.#fetchBatchSize,
          expires: this.#fetchExpiresMs,
        });

        if (messages.length === 0) {
          await sleep(this.#idlePauseMs);
          continue;
        }

        await this.#processBatch(messages);
      } catch (error) {
        this.#log.error('Projection worker fetch error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Brief back-off on unexpected errors to avoid tight error loops
        await sleep(this.#idlePauseMs * 2);
      }
    }
  }

  async #processBatch(messages: readonly JetstreamMessage[]): Promise<void> {
    const payloads: EvidencePayload[] = [];
    const validMessages: JetstreamMessage[] = [];
    const invalidMessages: JetstreamMessage[] = [];

    for (const msg of messages) {
      const payload = parseEvidencePayload(msg.data);
      if (payload === undefined) {
        this.#log.warn('Skipping unparseable evidence message', { subject: msg.subject });
        invalidMessages.push(msg);
      } else {
        payloads.push(payload);
        validMessages.push(msg);
      }
    }

    // Ack invalid messages immediately (no retry benefit)
    for (const msg of invalidMessages) {
      msg.ack();
    }

    if (payloads.length === 0) return;

    // All evidence in a batch shares the same workspaceId + runId
    // (stream partitioned by workspace+run in production)
    const first = payloads[0];
    if (first === undefined) return;

    const workspaceId = first.workspaceId;
    const runId = first.runId;

    try {
      const result = await projectEvidenceBatch(
        this.#deps,
        this.#config,
        workspaceId,
        runId,
        payloads,
      );

      this.#log.info('Evidence batch projected', {
        workspaceId: String(workspaceId),
        runId: String(runId),
        artifactsCreated: result.artifactsCreated,
        evidenceProcessed: result.evidenceProcessed,
        skipped: result.skipped,
      });

      // Ack all messages after successful projection
      for (const msg of validMessages) {
        msg.ack();
      }
    } catch (error) {
      this.#log.error('Evidence batch projection failed', {
        workspaceId: String(workspaceId),
        runId: String(runId),
        error: error instanceof Error ? error.message : String(error),
      });
      // Nak for re-delivery
      for (const msg of validMessages) {
        msg.nak();
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
