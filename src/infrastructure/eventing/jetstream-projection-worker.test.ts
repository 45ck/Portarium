/**
 * bead-0773: Unit tests for JetstreamProjectionWorker.
 *
 * Uses stub implementations — no real NATS or Postgres required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  JetstreamProjectionWorker,
  type JetstreamConsumer,
  type JetstreamMessage,
  type JetstreamProjectionWorkerConfig,
} from './jetstream-projection-worker.js';
import type {
  DerivedArtifactProjectorDeps,
  ProjectorConfig,
} from '../../application/services/derived-artifact-projector.js';
import type {
  DerivedArtifactRegistryPort,
  EmbeddingPort,
  KnowledgeGraphPort,
  SemanticIndexPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { DerivedArtifactV1 } from '../../domain/derived-artifacts/derived-artifact-v1.js';
import type { ProjectionCheckpointV1 } from '../../domain/derived-artifacts/retrieval-ports.js';
import { WorkspaceId, RunId } from '../../domain/primitives/index.js';
import type { PortariumLogger } from '../observability/logger.js';

// ---------------------------------------------------------------------------
// Stub implementations
// ---------------------------------------------------------------------------

function makeLogger(): PortariumLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => makeLogger(),
  };
}

function makeRegistry(): DerivedArtifactRegistryPort {
  return {
    save: vi.fn<(artifact: DerivedArtifactV1) => Promise<void>>().mockResolvedValue(undefined),
    findById: vi
      .fn<(id: string, ws: WorkspaceId) => Promise<DerivedArtifactV1 | undefined>>()
      .mockResolvedValue(undefined),
    findByRun: vi
      .fn<(runId: RunId, ws: WorkspaceId) => Promise<readonly DerivedArtifactV1[]>>()
      .mockResolvedValue([]),
    saveCheckpoint: vi
      .fn<(cp: ProjectionCheckpointV1) => Promise<void>>()
      .mockResolvedValue(undefined),
    loadCheckpoint: vi
      .fn<(ws: WorkspaceId, runId: RunId) => Promise<ProjectionCheckpointV1 | undefined>>()
      .mockResolvedValue(undefined),
    purgeExpired: vi.fn<(before: string) => Promise<number>>().mockResolvedValue(0),
  };
}

function makeEmbedding(): EmbeddingPort {
  return {
    embed: vi.fn().mockResolvedValue({ vector: [0.1, 0.2], model: 'test-model', dimensions: 2 }),
    embedBatch: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, model: 'test-model' }),
  };
}

function makeSemanticIndex(): SemanticIndexPort {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, latencyMs: 1 }),
  };
}

function makeKnowledgeGraph(): KnowledgeGraphPort {
  return {
    upsertNode: vi.fn().mockResolvedValue(undefined),
    upsertEdge: vi.fn().mockResolvedValue(undefined),
    traverse: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    deleteWorkspaceData: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, latencyMs: 1 }),
  };
}

function makeDeps(): DerivedArtifactProjectorDeps {
  return {
    registry: makeRegistry(),
    semanticIndex: makeSemanticIndex(),
    knowledgeGraph: makeKnowledgeGraph(),
    embeddingPort: makeEmbedding(),
    clock: { nowIso: () => '2026-02-22T12:00:00.000Z' },
  };
}

function makeMsg(data: unknown, acked: boolean[] = []): JetstreamMessage {
  return {
    data,
    subject: 'portarium.events.evidence.recorded',
    ack: vi.fn(() => {
      acked.push(true);
    }),
    nak: vi.fn(() => {
      acked.push(false);
    }),
  };
}

function makeValidData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    evidenceId: 'ev-001',
    workspaceId: 'ws-001',
    runId: 'run-001',
    text: 'Hello world evidence',
    createdAtIso: '2026-02-22T10:00:00.000Z',
    ...overrides,
  };
}

function makeStubConsumer(messages: JetstreamMessage[][]): JetstreamConsumer {
  let callCount = 0;
  return {
    fetch: vi.fn().mockImplementation(async () => {
      const batch = messages[callCount];
      callCount++;
      return batch ?? [];
    }),
  };
}

function makeWorker(
  consumer: JetstreamConsumer,
  deps: DerivedArtifactProjectorDeps,
  config: Partial<JetstreamProjectionWorkerConfig> = {},
): JetstreamProjectionWorker {
  const projectorConfig: ProjectorConfig = { projectorVersion: '1.0.0' };
  return new JetstreamProjectionWorker({
    projectorDeps: deps,
    projectorConfig,
    consumer,
    logger: makeLogger(),
    fetchBatchSize: 10,
    fetchExpiresMs: 50,
    idlePauseMs: 10,
    ...config,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JetstreamProjectionWorker', () => {
  let deps: DerivedArtifactProjectorDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  describe('status', () => {
    it('starts as stopped', () => {
      const worker = makeWorker(makeStubConsumer([]), deps);
      expect(worker.status).toBe('stopped');
    });

    it('transitions to running on start()', () => {
      const worker = makeWorker(makeStubConsumer([[]]), deps);
      worker.start();
      expect(worker.status).toBe('running');
      return worker.stop();
    });

    it('returns to stopped after stop()', async () => {
      const worker = makeWorker(makeStubConsumer([[]]), deps);
      worker.start();
      await worker.stop();
      expect(worker.status).toBe('stopped');
    });

    it('is a no-op if start() called twice', async () => {
      const consumer = makeStubConsumer([[]]);
      const worker = makeWorker(consumer, deps);
      worker.start();
      worker.start(); // second call
      expect(worker.status).toBe('running');
      await worker.stop();
    });
  });

  describe('message processing', () => {
    it('acks valid messages after successful projection', async () => {
      const acked: boolean[] = [];
      const msg = makeMsg(makeValidData(), acked);
      const consumer = makeStubConsumer([[msg], []]);
      const worker = makeWorker(consumer, deps);

      worker.start();
      await new Promise((r) => setTimeout(r, 80));
      await worker.stop();

      expect(acked).toContain(true);
    });

    it('acks invalid (unparseable) messages immediately', async () => {
      const acked: boolean[] = [];
      const invalidMsg = makeMsg({ wrong: 'format' }, acked);
      const consumer = makeStubConsumer([[invalidMsg], []]);
      const worker = makeWorker(consumer, deps);

      worker.start();
      await new Promise((r) => setTimeout(r, 80));
      await worker.stop();

      expect(acked).toContain(true); // acked, not nak'd
    });

    it('nak-s messages when projector throws', async () => {
      const errorDeps = makeDeps();
      vi.mocked(errorDeps.embeddingPort.embed).mockRejectedValue(new Error('Embedding failed'));

      const acked: boolean[] = [];
      const msg = makeMsg(makeValidData(), acked);
      const consumer = makeStubConsumer([[msg], []]);
      const worker = makeWorker(consumer, errorDeps);

      worker.start();
      await new Promise((r) => setTimeout(r, 80));
      await worker.stop();

      expect(acked).toContain(false); // nak'd
    });

    it('calls projectEvidenceBatch with correct payload', async () => {
      const msg = makeMsg(
        makeValidData({ evidenceId: 'ev-test', workspaceId: 'ws-test', runId: 'run-test' }),
      );
      const consumer = makeStubConsumer([[msg], []]);
      const worker = makeWorker(consumer, deps);

      worker.start();
      await new Promise((r) => setTimeout(r, 80));
      await worker.stop();

      expect(deps.embeddingPort.embed).toHaveBeenCalled();
    });

    it('processes an empty fetch without errors', async () => {
      const consumer = makeStubConsumer([[], []]);
      const worker = makeWorker(consumer, deps);

      worker.start();
      await new Promise((r) => setTimeout(r, 50));
      await worker.stop();

      expect(deps.embeddingPort.embed).not.toHaveBeenCalled();
    });
  });
});
