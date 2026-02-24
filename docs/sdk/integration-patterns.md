# SDK Integration Patterns

This guide covers the three primary integration patterns for Portarium adopters.
For SDK API reference, see `docs/sdk/`.

## Connector Author

A Connector Author builds and publishes a **vertical pack** — a versioned bundle of
workflow steps, capability declarations, and connector configuration that extends
Portarium's capability matrix.

### Scaffold a vertical pack

```typescript
import { PortariumClient } from '@portarium/sdk';

const client = new PortariumClient({
  baseUrl: process.env['PORTARIUM_URL'] ?? 'http://localhost:3000',
  apiKey: process.env['PORTARIUM_API_KEY'] ?? '',
});

// Register a new vertical pack version
const pack = await client.packs.register({
  packId: 'my-connector-pack',
  version: '1.0.0',
  capabilities: ['my-domain:action-a', 'my-domain:action-b'],
  manifest: {
    name: 'My Connector Pack',
    description: 'Extends Portarium with my-domain capabilities',
  },
});

console.log('Pack registered:', pack.packId, '@', pack.version);
```

### Pack manifest structure

Vertical packs live in `vertical-packs/<pack-id>/manifest.json`. See
`docs/internal/vertical-packs/authoring-guide.md` for the full schema.

---

## Orchestration Consumer

An Orchestration Consumer triggers Portarium workflows from their own services
and handles run results asynchronously.

### Start a workflow run

```typescript
import { PortariumClient } from '@portarium/sdk';

const client = new PortariumClient({
  baseUrl: process.env['PORTARIUM_URL'] ?? 'http://localhost:3000',
  apiKey: process.env['PORTARIUM_API_KEY'] ?? '',
});

// Start a governed workflow run
const run = await client.runs.start({
  workflowId: 'my-approval-workflow',
  workspaceId: 'workspace-default',
  input: {
    targetEntity: 'entity-123',
    requestedBy: 'user@example.com',
  },
});

console.log('Run started:', run.runId, '— status:', run.status);
```

### Poll for completion

```typescript
// Poll until terminal state
let current = run;
while (current.status === 'running' || current.status === 'pending_approval') {
  await new Promise((r) => setTimeout(r, 2000));
  current = await client.runs.get({ runId: run.runId, workspaceId: 'workspace-default' });
  console.log('Run status:', current.status);
}

console.log('Run completed:', current.status, '— evidence:', current.evidenceChainId);
```

### Handle approval gates

Runs that include an approval gate pause at `pending_approval`. A Governance Reviewer
must approve before the run resumes. The Orchestration Consumer may subscribe to
run-status events via the CloudEvents endpoint.

---

## Governance Reviewer

A Governance Reviewer inspects evidence chains to verify that a run complied with
declared policy, and approves or rejects pending approval gates.

### Verify an evidence chain

```typescript
import { EvidenceChainVerifier, PortariumClient } from '@portarium/sdk';

const client = new PortariumClient({
  baseUrl: process.env['PORTARIUM_URL'] ?? 'http://localhost:3000',
  apiKey: process.env['PORTARIUM_API_KEY'] ?? '',
});

const verifier = new EvidenceChainVerifier();

// Fetch and verify the evidence chain for a completed run
const chain = await client.evidence.getChain({
  runId: 'run-abc-123',
  workspaceId: 'workspace-default',
});

const result = await verifier.verify(chain);

if (result.valid) {
  console.log('Evidence chain intact — all hashes match.');
} else {
  console.error('Chain integrity failure:', result.violations);
}
```

### Approve a pending run

```typescript
// Approve an approval gate on a pending run
await client.approvals.submit({
  runId: 'run-abc-123',
  workspaceId: 'workspace-default',
  decision: 'approved',
  comment: 'Risk assessment complete; proceeding.',
  reviewerId: 'reviewer@example.com',
});

console.log('Approval submitted.');
```

---

## Next steps

- [Adoption Ladder](../adoption/adoption-ladder.md) — progress from L1 to L3
- [Adoption Readiness Checklist](../adoption/adoption-readiness-checklist.md) — production gate
- [GTM Playbook](../adoption/gtm-playbook.md) — community and conversion guidance
