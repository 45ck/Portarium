/**
 * Shared scenario assertion helpers and fixture contracts.
 *
 * Centralizes duplicated stub infrastructure and assertion patterns used
 * across scenario test files. Scenarios import typed helpers instead of
 * re-implementing HTTP stub servers and evidence log stubs inline.
 *
 * Bead: bead-0858
 */

import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { vi } from 'vitest';

import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type { EvidenceId, HashSha256 } from '../../src/domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Stub HTTP gateway
// ---------------------------------------------------------------------------

/**
 * A captured HTTP request from the stub gateway, including parsed JSON body.
 */
export type CapturedRequest = Readonly<{
  method: string;
  path: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: Record<string, unknown>;
}>;

export type StubGatewayResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type StubGatewayHandle = Readonly<{
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}>;

/**
 * Start an in-process HTTP stub gateway that serves queued responses
 * by path. Each queued response is consumed once in FIFO order; paths
 * with no remaining responses return 404.
 *
 * @example
 * ```ts
 * const gw = await startStubGateway({
 *   '/v1/responses': [{ status: 200, body: { ok: true } }],
 * });
 * try {
 *   // ... make requests to gw.baseUrl ...
 *   expect(gw.requests).toHaveLength(1);
 * } finally {
 *   await gw.close();
 * }
 * ```
 */
export async function startStubGateway(
  responses: Record<string, StubGatewayResponse[]>,
): Promise<StubGatewayHandle> {
  const requestLog: CapturedRequest[] = [];
  const queues = new Map(Object.entries(responses).map(([path, resps]) => [path, [...resps]]));

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      const path = req.url ?? '/';
      const bodyText = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        /* empty body is ok */
      }
      requestLog.push({ method: req.method ?? '', path, headers: req.headers, body });

      const queue = queues.get(path) ?? [];
      const next = queue.shift();
      if (!next) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'no_stub' }));
        return;
      }
      res.writeHead(next.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(next.body));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Could not bind stub gateway.');

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requests: requestLog,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ---------------------------------------------------------------------------
// Stub evidence log
// ---------------------------------------------------------------------------

export type StubEvidenceLog = EvidenceLogPort & {
  readonly entries: Record<string, unknown>[];
};

/**
 * Create a stub evidence log that records appended entries in memory with
 * a deterministic hash chain. Each entry receives a sequential evidenceId,
 * hashSha256, and previousHash (linking to the prior entry).
 *
 * @param prefix — ID prefix for generated evidence/hash IDs (default: 'ev')
 */
export function makeStubEvidenceLog(prefix = 'ev'): StubEvidenceLog {
  const entries: Record<string, unknown>[] = [];
  let counter = 0;
  return {
    entries,
    appendEntry: vi.fn(async (_tenantId, entry) => {
      counter += 1;
      const stored = {
        ...entry,
        schemaVersion: 1 as const,
        evidenceId: `${prefix}-${counter}` as EvidenceId,
        previousHash: counter > 1 ? (`hash-${prefix}-${counter - 1}` as HashSha256) : undefined,
        hashSha256: `hash-${prefix}-${counter}` as HashSha256,
      };
      entries.push(stored as unknown as Record<string, unknown>);
      return stored;
    }),
  };
}

// ---------------------------------------------------------------------------
// Evidence assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that an evidence entry has the expected category and correlationId.
 * Returns the entry for further chained assertions.
 */
export function assertEvidenceEntry(
  entry: Record<string, unknown>,
  expected: { category: string; correlationId: string },
): Record<string, unknown> {
  if (entry['category'] !== expected.category) {
    throw new Error(
      `Expected evidence category "${expected.category}", got "${String(entry['category'])}"`,
    );
  }
  if (entry['correlationId'] !== expected.correlationId) {
    throw new Error(
      `Expected correlationId "${expected.correlationId}", got "${String(entry['correlationId'])}"`,
    );
  }
  return entry;
}

/**
 * Assert that a sequence of evidence entries forms a valid hash chain
 * (each entry's previousHash equals the prior entry's hashSha256).
 */
export function assertHashChain(entries: readonly Record<string, unknown>[]): void {
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]!;
    const curr = entries[i]!;
    if (curr['previousHash'] !== prev['hashSha256']) {
      throw new Error(
        `Hash chain broken at entry ${i}: previousHash="${String(curr['previousHash'])}" ` +
          `!= prior hashSha256="${String(prev['hashSha256'])}"`,
      );
    }
  }
}

/**
 * Assert that an evidence entry links to the expected runId.
 */
export function assertEvidenceRunLink(entry: Record<string, unknown>, expectedRunId: string): void {
  const links = entry['links'] as Record<string, unknown> | undefined;
  if (links?.['runId'] !== expectedRunId) {
    throw new Error(
      `Expected evidence links.runId="${expectedRunId}", got "${String(links?.['runId'])}"`,
    );
  }
}
