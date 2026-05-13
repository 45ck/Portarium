# GSLR-21 Static Verification Design Split: 2026-05-13

Status: implemented as docs/test-only domain contract
Tracking bead: `bead-1268`

## Decision

`bead-1268` separates the next import blocker into two explicit readiness
questions:

```text
production keyring readiness
artifact-byte verification readiness
```

The split is implemented as a static design evaluator, not as production
integration. It does not add a real production keyring, live artifact fetching,
database persistence, queues, SSE, runtime Cockpit cards, production actions, or
MC connector/source-system access.

## What Was Built

The new contract is:

```text
portarium.gslr-static-import-verification-design.v1
```

The code lives at:

```text
src/domain/evidence/gslr-static-import-verification-design-v1.ts
src/domain/evidence/gslr-static-import-verification-design-v1.test.ts
```

The recommended design requires:

- production keyring trust source;
- pinned static trust store, not network discovery;
- `ed25519` only, with `test-ed25519` excluded;
- documented key revocation;
- documented key rotation;
- operator-supplied artifact bytes at the static verifier boundary;
- SHA-256 byte hashing;
- missing artifact bytes blocked;
- hash mismatches quarantined;
- raw/source payload bodies rejected;
- runtime authority `none`;
- action controls `absent`;
- live endpoints `blocked`;
- MC connector access `blocked`.

## What It Blocks

The evaluator blocks:

- test-fixture key trust;
- network-discovered keyrings;
- missing revocation or rotation policy;
- `test-ed25519`;
- declared-hashes-only artifact handling;
- live-source artifact fetching;
- missing byte allowance;
- hash mismatch allowance;
- raw payload allowance;
- runtime route-decision or action authority;
- action controls;
- live endpoints;
- MC connector access.

## What It Proves

This proves we can describe the trust boundary before implementing it:

```text
verified bundle
  -> keyring design gate
  -> artifact-byte design gate
  -> static append planning
```

The key point is that artifact bytes must be supplied into the static verifier
boundary and hash-checked before append. This is different from letting Cockpit
fetch live source artifacts, which remains blocked.

## What Remains Blocked

Still blocked:

- production keyring implementation;
- key distribution or rotation service;
- live artifact fetching;
- artifact byte storage;
- production imported-record persistence;
- production imported-record repository implementation;
- route-record queues or database tables;
- SSE streams for GSLR evidence;
- runtime Cockpit engineering cards;
- automatic route decisions;
- production actions;
- MC connector observation;
- source-system reads/writes;
- raw school-data movement.

## Validation

Focused validation:

```sh
npm run test -- src/domain/evidence/gslr-static-import-verification-design-v1.test.ts
```

The focused tests prove:

- the recommended static verification design is ready;
- test fixtures, network-discovered keyrings, and missing key lifecycle policies
  are blocked;
- declared-hash-only and live-source artifact byte designs are blocked;
- runtime authority, actions, live endpoints, and MC connector access are
  blocked;
- result and design objects are frozen.

## Next Step

Update: `bead-1269` has now implemented the persistent static imported-record
storage design gate. See
[`gslr-22-persistent-static-storage-design-2026-05-13.md`](./gslr-22-persistent-static-storage-design-2026-05-13.md).
