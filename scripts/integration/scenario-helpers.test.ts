/**
 * Tests for shared scenario assertion helpers and fixture contracts.
 *
 * Guards helper behavior to prevent regressions when helpers are modified.
 *
 * Bead: bead-0858
 */

import { describe, expect, it } from 'vitest';

import {
  assertEvidenceEntry,
  assertEvidenceRunLink,
  assertHashChain,
  makeStubEvidenceLog,
  startStubGateway,
} from './scenario-helpers.js';

// ---------------------------------------------------------------------------
// startStubGateway
// ---------------------------------------------------------------------------

describe('startStubGateway', () => {
  it('serves queued responses by path in FIFO order', async () => {
    const gw = await startStubGateway({
      '/test': [
        { status: 200, body: { n: 1 } },
        { status: 201, body: { n: 2 } },
      ],
    });

    try {
      const r1 = await fetch(`${gw.baseUrl}/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: 1 }),
      });
      expect(r1.status).toBe(200);
      expect(await r1.json()).toEqual({ n: 1 });

      const r2 = await fetch(`${gw.baseUrl}/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: 2 }),
      });
      expect(r2.status).toBe(201);
      expect(await r2.json()).toEqual({ n: 2 });

      expect(gw.requests).toHaveLength(2);
      expect(gw.requests[0]!.body).toEqual({ a: 1 });
      expect(gw.requests[1]!.body).toEqual({ a: 2 });
    } finally {
      await gw.close();
    }
  });

  it('returns 404 when path has no queued responses', async () => {
    const gw = await startStubGateway({});

    try {
      const r = await fetch(`${gw.baseUrl}/missing`);
      expect(r.status).toBe(404);
    } finally {
      await gw.close();
    }
  });

  it('captures request method, path, and headers', async () => {
    const gw = await startStubGateway({
      '/check': [{ status: 200, body: {} }],
    });

    try {
      await fetch(`${gw.baseUrl}/check`, {
        method: 'PUT',
        headers: { 'x-custom': 'hello' },
      });

      expect(gw.requests).toHaveLength(1);
      expect(gw.requests[0]!.method).toBe('PUT');
      expect(gw.requests[0]!.path).toBe('/check');
      expect(gw.requests[0]!.headers['x-custom']).toBe('hello');
    } finally {
      await gw.close();
    }
  });
});

// ---------------------------------------------------------------------------
// makeStubEvidenceLog
// ---------------------------------------------------------------------------

describe('makeStubEvidenceLog', () => {
  it('appends entries with sequential IDs and hash chain', async () => {
    const log = makeStubEvidenceLog('test');

    const e1 = await log.appendEntry('t1' as never, {
      schemaVersion: 1,
      evidenceId: 'ignored' as never,
      workspaceId: 'ws' as never,
      correlationId: 'corr' as never,
      occurredAtIso: '2026-01-01T00:00:00.000Z',
      category: 'System',
      summary: 'First',
      actor: { kind: 'System' },
    });

    const e2 = await log.appendEntry('t1' as never, {
      schemaVersion: 1,
      evidenceId: 'ignored' as never,
      workspaceId: 'ws' as never,
      correlationId: 'corr' as never,
      occurredAtIso: '2026-01-01T00:00:01.000Z',
      category: 'Action',
      summary: 'Second',
      actor: { kind: 'System' },
    });

    expect(e1.evidenceId).toBe('test-1');
    expect(e1.hashSha256).toBe('hash-test-1');
    expect(e1.previousHash).toBeUndefined();

    expect(e2.evidenceId).toBe('test-2');
    expect(e2.hashSha256).toBe('hash-test-2');
    expect(e2.previousHash).toBe('hash-test-1');

    expect(log.entries).toHaveLength(2);
  });

  it('uses default prefix when none provided', async () => {
    const log = makeStubEvidenceLog();

    const e = await log.appendEntry('t' as never, {
      schemaVersion: 1,
      evidenceId: 'x' as never,
      workspaceId: 'ws' as never,
      correlationId: 'c' as never,
      occurredAtIso: '2026-01-01T00:00:00.000Z',
      category: 'System',
      summary: 'Test',
      actor: { kind: 'System' },
    });

    expect(e.evidenceId).toBe('ev-1');
  });
});

// ---------------------------------------------------------------------------
// assertEvidenceEntry
// ---------------------------------------------------------------------------

describe('assertEvidenceEntry', () => {
  it('passes for matching category and correlationId', () => {
    const entry = { category: 'Action', correlationId: 'corr-1' };
    const result = assertEvidenceEntry(entry, { category: 'Action', correlationId: 'corr-1' });
    expect(result).toBe(entry);
  });

  it('throws on category mismatch', () => {
    const entry = { category: 'System', correlationId: 'corr-1' };
    expect(() =>
      assertEvidenceEntry(entry, { category: 'Action', correlationId: 'corr-1' }),
    ).toThrow('Expected evidence category "Action"');
  });

  it('throws on correlationId mismatch', () => {
    const entry = { category: 'Action', correlationId: 'corr-2' };
    expect(() =>
      assertEvidenceEntry(entry, { category: 'Action', correlationId: 'corr-1' }),
    ).toThrow('Expected correlationId "corr-1"');
  });
});

// ---------------------------------------------------------------------------
// assertHashChain
// ---------------------------------------------------------------------------

describe('assertHashChain', () => {
  it('passes for a valid chain', () => {
    const entries = [
      { hashSha256: 'h1', previousHash: undefined },
      { hashSha256: 'h2', previousHash: 'h1' },
      { hashSha256: 'h3', previousHash: 'h2' },
    ];
    expect(() => assertHashChain(entries)).not.toThrow();
  });

  it('throws on broken chain', () => {
    const entries = [
      { hashSha256: 'h1', previousHash: undefined },
      { hashSha256: 'h2', previousHash: 'WRONG' },
    ];
    expect(() => assertHashChain(entries)).toThrow('Hash chain broken at entry 1');
  });

  it('passes for single entry', () => {
    expect(() => assertHashChain([{ hashSha256: 'h1' }])).not.toThrow();
  });

  it('passes for empty array', () => {
    expect(() => assertHashChain([])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertEvidenceRunLink
// ---------------------------------------------------------------------------

describe('assertEvidenceRunLink', () => {
  it('passes when links.runId matches', () => {
    const entry = { links: { runId: 'run-1' } };
    expect(() => assertEvidenceRunLink(entry, 'run-1')).not.toThrow();
  });

  it('throws when links.runId does not match', () => {
    const entry = { links: { runId: 'run-2' } };
    expect(() => assertEvidenceRunLink(entry, 'run-1')).toThrow('Expected evidence links.runId');
  });

  it('throws when links is missing', () => {
    const entry = {};
    expect(() => assertEvidenceRunLink(entry, 'run-1')).toThrow('Expected evidence links.runId');
  });
});
