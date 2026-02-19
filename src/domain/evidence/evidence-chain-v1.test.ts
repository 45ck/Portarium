import { describe, expect, it } from 'vitest';

import { CorrelationId, EvidenceId, HashSha256, WorkspaceId } from '../primitives/index.js';
import {
  appendEvidenceEntryV1,
  canonicalizeEvidenceEntryV1,
  signEvidenceEntryV1,
  verifyEvidenceChainV1,
} from './evidence-chain-v1.js';
import type { EvidenceEntryV1, EvidenceEntryV1WithoutHash } from './evidence-entry-v1.js';
import type {
  EvidenceHasher,
  EvidenceSigner,
  EvidenceSignatureVerifier,
} from './evidence-hasher.js';

const testHasher: EvidenceHasher = {
  sha256Hex(input: string) {
    return HashSha256(fakeSha256Hex(input));
  },
};

function fakeSha256Hex(input: string): string {
  // FNV-1a 32-bit, expanded to 64 hex chars to resemble SHA-256 output.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').repeat(8);
}

const ALWAYS_VALID_SIG = 'valid-sig-stub';

const testSigner: EvidenceSigner = {
  sign(input: string) {
    void input;
    return ALWAYS_VALID_SIG;
  },
};

const testVerifier: EvidenceSignatureVerifier = {
  verify(input: string, signatureBase64: string) {
    void input;
    return signatureBase64 === ALWAYS_VALID_SIG;
  },
};

describe('Evidence chain v1', () => {
  it('canonicalization is stable across object key order', () => {
    const a: EvidenceEntryV1WithoutHash = {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-1'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-16T00:00:00.000Z',
      category: 'System',
      summary: 'hello',
      actor: { kind: 'System' },
    };

    const b: EvidenceEntryV1WithoutHash = {
      actor: { kind: 'System' },
      summary: 'hello',
      category: 'System',
      occurredAtIso: '2026-02-16T00:00:00.000Z',
      correlationId: CorrelationId('corr-1'),
      workspaceId: WorkspaceId('ws-1'),
      evidenceId: EvidenceId('ev-1'),
      schemaVersion: 1,
    };

    expect(canonicalizeEvidenceEntryV1(a)).toBe(canonicalizeEvidenceEntryV1(b));
  });

  it('appendEvidenceEntryV1 links to the previous hash', () => {
    const e1 = appendEvidenceEntryV1({
      previous: undefined,
      hasher: testHasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-1'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-16T00:00:00.000Z',
        category: 'System',
        summary: 'first',
        actor: { kind: 'System' },
      },
    });

    const e2 = appendEvidenceEntryV1({
      previous: e1,
      hasher: testHasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-2'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-16T00:00:01.000Z',
        category: 'System',
        summary: 'second',
        actor: { kind: 'System' },
      },
    });

    expect(e2.previousHash).toBe(e1.hashSha256);
    expect(verifyEvidenceChainV1([e1, e2], testHasher)).toEqual({ ok: true });
  });

  it('detects tampering via hash mismatch', () => {
    const chain = buildChain();
    const tampered: EvidenceEntryV1 = { ...chain[1]!, summary: 'tampered' };

    const res = verifyEvidenceChainV1([chain[0]!, tampered, chain[2]!], testHasher);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(1);
      expect(res.reason).toBe('hash_mismatch');
    }
  });

  it('detects previousHash mismatches', () => {
    const chain = buildChain();
    const broken: EvidenceEntryV1 = {
      ...chain[1]!,
      previousHash: HashSha256('deadbeef'.repeat(8)),
    };

    const res = verifyEvidenceChainV1([chain[0]!, broken, chain[2]!], testHasher);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(1);
      expect(res.reason).toBe('previous_hash_mismatch');
    }
  });

  it('rejects unexpected previousHash on the first entry', () => {
    const e1 = appendEvidenceEntryV1({
      previous: undefined,
      hasher: testHasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-1'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-16T00:00:00.000Z',
        category: 'System',
        summary: 'first',
        actor: { kind: 'System' },
      },
    });

    const badFirst: EvidenceEntryV1 = { ...e1, previousHash: HashSha256('deadbeef'.repeat(8)) };
    const res = verifyEvidenceChainV1([badFirst], testHasher);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(0);
      expect(res.reason).toBe('unexpected_previous_hash');
    }
  });

  it('detects timestamp monotonicity violation', () => {
    const chain = buildChain();
    // Swap e2 with a version whose timestamp is earlier than e1
    const outOfOrder: EvidenceEntryV1 = {
      ...chain[1]!,
      occurredAtIso: '2026-02-15T23:59:59.000Z',
    };

    const res = verifyEvidenceChainV1([chain[0]!, outOfOrder, chain[2]!], testHasher);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(1);
      expect(res.reason).toBe('timestamp_not_monotonic');
    }
  });

  it('allows equal timestamps in the chain', () => {
    const e1 = appendEvidenceEntryV1({
      previous: undefined,
      hasher: testHasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-1'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-16T00:00:00.000Z',
        category: 'System',
        summary: 'first',
        actor: { kind: 'System' },
      },
    });

    const e2 = appendEvidenceEntryV1({
      previous: e1,
      hasher: testHasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-2'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        // same timestamp as e1 — allowed (monotonic, not strictly increasing)
        occurredAtIso: '2026-02-16T00:00:00.000Z',
        category: 'System',
        summary: 'second',
        actor: { kind: 'System' },
      },
    });

    expect(verifyEvidenceChainV1([e1, e2], testHasher)).toEqual({ ok: true });
  });

  it('rejects appending entries with non-minimised metadata', () => {
    expect(() =>
      appendEvidenceEntryV1({
        previous: undefined,
        hasher: testHasher,
        next: {
          schemaVersion: 1,
          evidenceId: EvidenceId('ev-1'),
          workspaceId: WorkspaceId('ws-1'),
          correlationId: CorrelationId('corr-1'),
          occurredAtIso: '2026-02-16T00:00:00.000Z',
          category: 'System',
          summary: 'Approved by alice@example.com',
          actor: { kind: 'System' },
        },
      }),
    ).toThrow(/email/i);
  });
});

describe('Signature hooks', () => {
  it('signEvidenceEntryV1 adds signatureBase64 to the entry', () => {
    const chain = buildChain();
    const signed = signEvidenceEntryV1(chain[0]!, testSigner);
    expect(signed.signatureBase64).toBe(ALWAYS_VALID_SIG);
    expect(signed.hashSha256).toBe(chain[0]!.hashSha256);
  });

  it('adding a signature does not change the entry hash', () => {
    const chain = buildChain();
    const signed = signEvidenceEntryV1(chain[0]!, testSigner);
    // Hash must remain stable after signing
    expect(signed.hashSha256).toBe(chain[0]!.hashSha256);
  });

  it('verifyEvidenceChainV1 passes with valid signatures', () => {
    const chain = buildChain().map((e) => signEvidenceEntryV1(e, testSigner));
    const res = verifyEvidenceChainV1(chain, testHasher, { verifier: testVerifier });
    expect(res).toEqual({ ok: true });
  });

  it('verifyEvidenceChainV1 skips signature check when verifier is absent', () => {
    // Even an invalid signature should be ignored when no verifier is supplied
    const chain = buildChain().map((e) => ({ ...e, signatureBase64: 'bad-sig' }));
    const res = verifyEvidenceChainV1(chain, testHasher);
    expect(res).toEqual({ ok: true });
  });

  it('verifyEvidenceChainV1 detects invalid signature', () => {
    const chain = buildChain().map((e) => signEvidenceEntryV1(e, testSigner));
    // Tamper one signature
    const tampered = chain.map((e, i) => (i === 1 ? { ...e, signatureBase64: 'bad-sig' } : e));
    const res = verifyEvidenceChainV1(tampered, testHasher, { verifier: testVerifier });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(1);
      expect(res.reason).toBe('signature_invalid');
    }
  });

  it('verifyEvidenceChainV1 skips signature check for unsigned entries', () => {
    // Entries without signatureBase64 should pass even when a verifier is supplied
    const chain = buildChain(); // unsigned
    const res = verifyEvidenceChainV1(chain, testHasher, { verifier: testVerifier });
    expect(res).toEqual({ ok: true });
  });
});

function buildChain(): readonly EvidenceEntryV1[] {
  const e1 = appendEvidenceEntryV1({
    previous: undefined,
    hasher: testHasher,
    next: {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-1'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-16T00:00:00.000Z',
      category: 'System',
      summary: 'first',
      actor: { kind: 'System' },
    },
  });

  const e2 = appendEvidenceEntryV1({
    previous: e1,
    hasher: testHasher,
    next: {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-2'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-16T00:00:01.000Z',
      category: 'System',
      summary: 'second',
      actor: { kind: 'System' },
    },
  });

  const e3 = appendEvidenceEntryV1({
    previous: e2,
    hasher: testHasher,
    next: {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-3'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-16T00:00:02.000Z',
      category: 'System',
      summary: 'third',
      actor: { kind: 'System' },
    },
  });

  return [e1, e2, e3];
}
