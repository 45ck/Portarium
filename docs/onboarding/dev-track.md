# Developer Onboarding Track

**Audience:** Integration developers building adapters or extending Portarium.
**Time:** ~1 hour to complete all steps.

---

## Learning Objectives

After completing this track you will be able to:

- Run the full local stack and verify a governed workflow end-to-end.
- Implement a conformant adapter using the MIS v0.1 interface.
- Write integration tests that verify the evidence chain.
- Use the SDK client to start runs and poll approvals.

---

## Track Steps

### 1. Environment Setup (10 min)

```bash
# Requirements: Node.js ≥ 22, npm ≥ 9
node --version   # should print v22.x.x
npm ci           # install all dependencies
npm run typecheck  # zero errors expected
npm run test       # all tests green
```

### 2. Hello Governed Workflow (15 min)

Follow [docs/tutorials/hello-governed-workflow.md](../tutorials/hello-governed-workflow.md).

At the end you should see all smoke tests passing and understand the
**plan → approval → action → evidence** execution path.

### 3. Implement a Stub Adapter (20 min)

Use the MIS v0.1 contract from `src/sdk/mis-v1.ts`:

```ts
import type { MisAdapterV1 } from '../../sdk/mis-v1.js';
import { MisResult } from '../../sdk/mis-v1.js';

export class MyServiceAdapter implements MisAdapterV1 {
  readonly meta = {
    schemaVersion: 1 as const,
    adapterId: 'my-service-v1',
    portFamily: 'CrmSales' as const,
    displayName: 'My CRM',
    supportedOperations: ['contact:list', 'contact:create'],
  };

  async health() {
    return { status: 'healthy' as const };
  }

  async invoke(op: string, payload: Record<string, unknown>, ctx: { dryRun?: boolean }) {
    if (ctx.dryRun) return MisResult.ok({ dryRun: true });
    // TODO: call your external service
    return MisResult.err('EXTERNAL_ERROR', 'Not yet implemented');
  }
}
```

Add it to `src/infrastructure/adapters/crm-sales/` following the existing
Odoo adapter as a reference.

### 4. Write Evidence-Chain Tests (10 min)

```ts
import { verifyEvidenceChain, sha256Hex } from '../../sdk/evidence-chain-verifier.js';

it('adapter produces a valid evidence chain', async () => {
  const entries = await runSmoke(adapter);
  const result = verifyEvidenceChain(entries, { computeHash: sha256Hex });
  expect(result.ok).toBe(true);
});
```

### 5. Architecture Deep Dive (5 min read)

- [ADR-0070: Hybrid orchestration + CloudEvents](../internal/adr/)
- [Port taxonomy](../domain/port-taxonomy.md)
- [Dependency layers](../reference/architecture-layers.md)

---

## Checklist

- [ ] `npm run test` passes with no failures.
- [ ] Your adapter implements `MisAdapterV1` (TypeScript will enforce this).
- [ ] You have at least one test that calls `verifyEvidenceChain` on the output.
- [ ] `npm run typecheck` is clean.
