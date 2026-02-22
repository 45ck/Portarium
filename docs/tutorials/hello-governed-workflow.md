# Tutorial: Hello Governed Workflow

**Time:** ~15 minutes | **Prerequisites:** Node.js ≥ 18, Docker (optional)

By the end of this tutorial you will have triggered a governed workflow run
through the Portarium control plane, observed the approval gate, confirmed an
adapter action was recorded, and verified the tamper-evident evidence chain.

---

## What You Will Build

```
You (HTTP) → Control Plane → Approval Gate → Adapter Action → Evidence Chain
```

A simple two-step workflow:

1. **Request** — you start a run via the SDK or CLI.
2. **Approval gate** — the control plane pauses and waits for a human (or
   auto-approval policy) to approve the action.
3. **Adapter action** — once approved, the control plane calls an adapter to
   perform the business operation (e.g. create an invoice in your ERP).
4. **Evidence** — every step is recorded as a hash-linked evidence entry you
   can inspect and verify.

---

## Step 1 — Bootstrap the Local Stack

```bash
# Clone and install
git clone https://github.com/45ck/Portarium.git
cd Portarium
npm ci

# Seed a demo workspace, machine, and agent
npm run seed:local
```

Expected output:

```
Portarium local dev seed

1. Workspace
  ✓ workspace created: id=ws-local-demo
2. Machine runtime
  ✓ machine registered: id=machine-local-runner
3. AI agent
  ✓ agent created: id=agent-local-classifier
4. Adapter registry (in-memory stubs available)
  ✓ 20 port families covered

✅ Seed complete.
```

---

## Step 2 — Run the Governed-Run Smoke Test

The fastest way to see a governed workflow end-to-end is to run the existing
smoke test suite:

```bash
npx vitest run src/infrastructure/adapters/governed-run-smoke.test.ts --reporter=verbose
```

This exercises the full path: plan creation → approval gate → adapter action →
evidence chain verification.

---

## Step 3 — Inspect the Evidence Chain

The smoke test prints the evidence entries that were produced. You can also
verify a chain programmatically using the SDK helper:

```ts
import { verifyEvidenceChain, sha256Hex } from './src/sdk/evidence-chain-verifier.js';

// `entries` comes from your evidence log API response
const result = verifyEvidenceChain(entries, { computeHash: sha256Hex });

if (result.ok) {
  console.log(`Chain valid — ${result.count} entries verified.`);
} else {
  console.error(`Chain broken at index ${result.index}: ${result.reason}`);
}
```

---

## Step 4 — Write Your First Adapter

Use the MIS v0.1 interface to wire up your own external service:

```ts
import { MisAdapterV1, MisAdapterMetaV1, MisResult } from './src/sdk/mis-v1.js';

class MyFinanceAdapter implements MisAdapterV1 {
  readonly meta: MisAdapterMetaV1 = {
    schemaVersion: 1,
    adapterId: 'my-finance-v1',
    portFamily: 'FinanceAccounting',
    displayName: 'My Finance System',
    supportedOperations: ['invoice:list', 'invoice:create'],
  };

  async health() {
    // Check connectivity to your ERP
    return { status: 'healthy' as const };
  }

  async invoke(operation: string, payload: Record<string, unknown>, ctx) {
    console.log(`[${ctx.correlationId}] ${operation}`, payload);
    if (ctx.dryRun) return MisResult.ok({ dryRun: true });

    if (operation === 'invoice:create') {
      // Call your ERP here
      return MisResult.ok({ invoiceId: 'INV-001', status: 'created' });
    }
    return MisResult.err('VALIDATION_FAILED', `Unknown operation: ${operation}`);
  }
}
```

Register it with your workspace and the control plane will route governed
actions to it automatically.

---

## Next Steps

| Role                  | Next doc                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| Developer             | [Dev Onboarding Track](../onboarding/dev-track.md)                                |
| SRE / Platform        | [SRE Onboarding Track](../onboarding/sre-track.md)                                |
| Security / Compliance | [SecOps Onboarding Track](../onboarding/secops-track.md)                          |
| All roles             | [How-to: First-run local integrations](../how-to/first-run-local-integrations.md) |
