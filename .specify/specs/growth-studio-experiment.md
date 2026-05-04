# Growth Studio Experiment v1

Status: Draft

Related bead: `bead-1001`

Extends:

- `iteration-2-governed-experiment-suite-v1`
- `openclaw-tool-blast-radius-policy-v1`
- `agent-action-governance-lifecycle-v1`
- `trusted-source-ingestion-citation-research-dossier-loop-v1`
- `outbound-communication-compliance-v1`

## Intent

Growth Studio is a governed experiment for researching a target market,
planning an outbound content motion, creating channel-ready drafts, obtaining
operator approval, executing approved Actions, and measuring Evidence Artifacts
from the result.

The experiment must keep every externally effectful Action behind an Approval
Gate unless a stricter policy requires manual execution or blocks the Action.
Read-only research and measurement Actions can run automatically when tool
classification and policy allow them, but they must still produce Evidence Log
entries with source attribution.

## Personas

### Researcher

Goal: discover and score prospects that match the ideal customer profile,
collect source-backed buying signals, and produce a cited research dossier for
planning.

Default autonomy tier: `Auto` for `ReadOnly` Actions that satisfy source trust,
freshness, and workspace policy. Any `Unknown`, low-confidence, or source policy
failure escalates to `HumanApprove`.

Approval requirements:

- No Approval Gate is required for allowed `ReadOnly` search, fetch, extract, or
  analysis Actions.
- An Approval Gate is required before using stale, untrusted, or operator-added
  sources in plan inputs.
- An Approval Gate is required before saving a prospect profile that includes
  inferred sensitive attributes or unsupported claims.

Tool set:

| Tool id                    | Purpose                                                           | OpenClaw category | Minimum tier |
| -------------------------- | ----------------------------------------------------------------- | ----------------- | ------------ |
| `search:prospect-web`      | Find public pages for matching accounts and contacts.             | `ReadOnly`        | `Auto`       |
| `fetch:prospect-page`      | Retrieve a public page for citation and extraction.               | `ReadOnly`        | `Auto`       |
| `extract:prospect-signals` | Extract buying signals, pains, roles, and source citations.       | `ReadOnly`        | `Auto`       |
| `analyze:icp-fit`          | Score prospect fit against the configured ideal customer profile. | `ReadOnly`        | `Auto`       |

### ContentCreator

Goal: turn an approved campaign plan and cited research dossier into draft
content for email, social, and owned-channel publication.

Default autonomy tier: `HumanApprove` for draft creation Actions because the
current OpenClaw classifier maps `create:*` tools to `Mutation`. Drafts may be
generated and stored only as non-executed Evidence Artifacts until an operator
approves them.

Approval requirements:

- An Approval Gate is required before generating channel drafts from a campaign
  plan that changes audience, offer, budget, or compliance constraints.
- An Approval Gate is required before any draft can be marked approved for
  execution.
- An Approval Gate is required when source citations are missing, claims exceed
  the research dossier, or channel policy flags prohibited language.

Tool set:

| Tool id                       | Purpose                                                         | OpenClaw category | Minimum tier   |
| ----------------------------- | --------------------------------------------------------------- | ----------------- | -------------- |
| `analyze:brand-voice`         | Compare planned copy against brand and compliance constraints.  | `ReadOnly`        | `Auto`         |
| `create:outreach-email-draft` | Create a draft email Artifact for an approved prospect segment. | `Mutation`        | `HumanApprove` |
| `create:linkedin-post-draft`  | Create a draft social Artifact for an approved campaign theme.  | `Mutation`        | `HumanApprove` |
| `create:blog-article-draft`   | Create a draft owned-channel Artifact with cited claims.        | `Mutation`        | `HumanApprove` |

### OutreachExecutor

Goal: execute only approved outbound and publishing Actions, record delivery
outcomes, update campaign state, and provide measurements for the next loop.

Default autonomy tier: `HumanApprove` for `send:*`, `publish:*`, and `update:*`
Actions because the current OpenClaw classifier maps them to `Mutation`. Channel
or compliance policy may elevate externally visible delivery to `ManualOnly` or
`Block`.

Approval requirements:

- An Approval Gate is required before every send, publish, CRM update, or other
  externally effectful Action.
- A manual operator checkpoint is required when outbound compliance returns
  `ManualOnly`, when policy fixtures are unavailable, or when workspace policy
  disables automated delivery.
- Execution must stop when the approved content hash, recipient list, channel,
  or schedule differs from the approval packet.

Tool set:

| Tool id                          | Purpose                                                           | OpenClaw category | Minimum tier   |
| -------------------------------- | ----------------------------------------------------------------- | ----------------- | -------------- |
| `send:approved-outreach-email`   | Send only the email body and recipient set in an approval packet. | `Mutation`        | `HumanApprove` |
| `publish:approved-linkedin-post` | Publish only the approved social draft to the approved account.   | `Mutation`        | `HumanApprove` |
| `publish:approved-blog-article`  | Publish only the approved owned-channel article.                  | `Mutation`        | `HumanApprove` |
| `update:campaign-crm-state`      | Persist delivery state, replies, and campaign status.             | `Mutation`        | `HumanApprove` |
| `read:campaign-metrics`          | Read opens, clicks, replies, and publication metrics.             | `ReadOnly`        | `Auto`         |

## Business Loop

The canonical loop is `research -> plan -> create -> approve -> execute ->
measure -> iterate`. Each stage must append Evidence Log entries for inputs,
decisions, tool classifications, policy decisions, and outputs.

| Stage      | Owner            | Inputs                                                                       | Outputs                                                                            | Allowed Actions                                               | Approval checkpoint                                                                                       |
| ---------- | ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `research` | Researcher       | Run input, ideal customer profile, trusted source policy.                    | Cited prospect profile, fit score, source dossier.                                 | `ReadOnly` search, fetch, extract, analyze.                   | Required before using low-trust, stale, or operator-added sources.                                        |
| `plan`     | Researcher       | Prospect profile, content brief, channel constraints, measurement goal.      | Campaign plan with target segment, offer, channels, schedule, and success metrics. | `ReadOnly` analysis and plan validation.                      | Required before creating drafts when audience, offer, channel, or budget changes.                         |
| `create`   | ContentCreator   | Approved campaign plan, research dossier, content brief, brand constraints.  | Draft email, social post, article, and citation map.                               | `ReadOnly` brand analysis; `Mutation` draft creation.         | Required for all draft creation and for any claim without cited support.                                  |
| `approve`  | Operator         | Draft Artifacts, content hashes, recipient set, channel policy result.       | Approval packet or rejection with required changes.                                | Approval Gate decision and policy evaluation.                 | Required before every send, publish, CRM update, or campaign expansion.                                   |
| `execute`  | OutreachExecutor | Approval packet, approved Artifacts, approved schedule, channel credentials. | Delivery receipts, publication URLs, CRM state updates, failure records.           | `Mutation` send, publish, update Actions permitted by policy. | Required when delivery target, content hash, schedule, or policy result differs from the approval packet. |
| `measure`  | OutreachExecutor | Execution results, channel metrics, replies, publication analytics.          | Measurement snapshot, lessons, next-loop recommendation.                           | `ReadOnly` metric reads and analysis.                         | Required before iterating if the recommendation expands audience, budget, channel, or autonomy tier.      |

## Contracts

### `GrowthStudioRunInputV1`

```ts
type GrowthStudioRunInputV1 = {
  workspaceId: string;
  projectId: string;
  icp: GrowthStudioIcpV1;
  contentBrief: GrowthStudioContentBriefV1;
  channels: Array<'email' | 'linkedin' | 'blog'>;
  budgetCeiling: {
    amount: number;
    currency: 'USD' | 'AUD' | 'GBP' | 'EUR';
  };
  operatorApproverPool: string[];
};
```

Requirements:

- `workspaceId`, `projectId`, and `operatorApproverPool` are required before
  any `Mutation` Action is requested.
- `channels` must be explicit; unspecified channels are out of scope for the
  run.
- `budgetCeiling.amount` must be non-negative and cannot be raised without a new
  Approval Gate.

### `GrowthStudioIcpV1`

```ts
type GrowthStudioIcpV1 = {
  segmentName: string;
  companyProfile: {
    companySize: string;
    geography: string[];
    industries: string[];
  };
  targetRoles: string[];
  pains: string[];
  exclusionCriteria: string[];
};
```

Output consumers must treat the ideal customer profile as the source of truth
for fit scoring. Any added qualifier or exclusion rule must be captured as a
plan change and approved before execution.

### `GrowthStudioScoredProspectV1`

```ts
type GrowthStudioScoredProspectV1 = {
  accountName: string;
  accountDomain: string;
  targetRole: string;
  fitScore: number;
  buyingSignals: Array<{
    signal: string;
    sourceUrl: string;
    observedAt: string;
  }>;
  exclusionCriteriaFound: string[];
  evidenceArtifactIds: string[];
};
```

Requirements:

- `fitScore` is a number from `0` to `100`.
- Every buying signal must include a source URL and observation timestamp.
- Unsupported or stale signals cannot be used in generated claims.

### `GrowthStudioCampaignPlanV1`

```ts
type GrowthStudioCampaignPlanV1 = {
  segment: string;
  objective: string;
  approvedChannels: Array<'email' | 'linkedin' | 'blog'>;
  offer: string;
  schedule: {
    startDate: string;
    endDate: string;
  };
  successMetrics: string[];
  approvalRequiredBeforeCreate: boolean;
};
```

Requirements:

- `approvalRequiredBeforeCreate` must be `true` when the plan introduces a new
  audience, offer, channel, budget use, or externally visible claim.
- The plan must link to prospect and content brief Evidence Artifacts.

### `GrowthStudioContentDraftV1`

```ts
type GrowthStudioContentDraftV1 = {
  draftId: string;
  channel: 'email' | 'linkedin' | 'blog';
  title: string;
  body: string;
  citationMap: Array<{
    claim: string;
    sourceUrl: string;
  }>;
  contentHash: string;
  status: 'draft' | 'needs_changes' | 'approved' | 'rejected';
};
```

Requirements:

- Drafts start in `draft` status and cannot be executed until the Approval Gate
  records `approved`.
- `contentHash` binds the approved content to the execution request.
- Claims without citation map entries must be removed or approved as operator
  assertions.

### `GrowthStudioApprovalPacketV1`

```ts
type GrowthStudioApprovalPacketV1 = {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  approvedContentHashes: string[];
  approvedRecipients: string[];
  approvedChannels: Array<'email' | 'linkedin' | 'blog'>;
  policyDecision: 'Allow' | 'NeedsApproval' | 'ManualOnly' | 'Block';
};
```

Requirements:

- `policyDecision` must come from the governance lifecycle and channel policy
  evaluation.
- `Block` prevents execution. `ManualOnly` requires operator execution outside
  the automated Action runner.
- Any recipient, channel, or content hash mismatch invalidates the packet.

### `GrowthStudioExecutionResultV1`

```ts
type GrowthStudioExecutionResultV1 = {
  executionId: string;
  approvalId: string;
  channel: 'email' | 'linkedin' | 'blog';
  result: 'sent' | 'published' | 'skipped' | 'failed' | 'manual_required';
  receiptUrl?: string;
  failureReason?: string;
  evidenceArtifactIds: string[];
};
```

Requirements:

- Failed, skipped, and `manual_required` results must return to the operator with
  the cause and supporting Evidence Artifacts.
- Receipt URLs are required for published content when the channel returns one.

### `GrowthStudioMeasurementSnapshotV1`

```ts
type GrowthStudioMeasurementSnapshotV1 = {
  snapshotId: string;
  measuredAt: string;
  executionIds: string[];
  metrics: Array<{
    name: string;
    value: number;
    source: string;
  }>;
  recommendation: 'continue' | 'revise_content' | 'revise_icp' | 'expand_campaign' | 'stop';
  approvalRequiredForNextLoop: boolean;
};
```

Requirements:

- `approvalRequiredForNextLoop` must be `true` for `expand_campaign` and for any
  recommendation that changes audience, budget, channel, or autonomy tier.
- Measurements must reference execution results and channel metric sources.

## Sample Ideal Customer Profile

```json
{
  "segmentName": "Mid-market operations teams adopting AI-assisted workflows",
  "companyProfile": {
    "companySize": "200-1500 employees",
    "geography": ["United States", "Canada", "United Kingdom"],
    "industries": ["B2B software", "professional services", "marketplaces"]
  },
  "targetRoles": ["VP Operations", "Head of Enablement", "RevOps Director"],
  "pains": [
    "manual research slows campaign planning",
    "approval evidence is scattered across tools",
    "teams need auditable AI assistance before outbound execution"
  ],
  "exclusionCriteria": [
    "consumer-only business model",
    "no documented outbound motion",
    "regulated use case requiring unsupported compliance controls"
  ]
}
```

Sample prospect profile:

```json
{
  "accountName": "Example Ops Cloud",
  "accountDomain": "example-ops-cloud.example",
  "targetRole": "VP Operations",
  "fitScore": 84,
  "buyingSignals": [
    {
      "signal": "Published a public hiring post for workflow automation leadership.",
      "sourceUrl": "https://example-ops-cloud.example/careers/workflow-automation-lead",
      "observedAt": "2026-05-04T00:00:00Z"
    },
    {
      "signal": "Described manual campaign quality checks in a public operations blog.",
      "sourceUrl": "https://example-ops-cloud.example/blog/operations-quality-checks",
      "observedAt": "2026-05-04T00:00:00Z"
    }
  ],
  "exclusionCriteriaFound": [],
  "evidenceArtifactIds": ["artifact_research_001", "artifact_research_002"]
}
```

## Sample Content Brief

```json
{
  "campaignName": "Auditable AI workflow pilot",
  "objective": "Book discovery calls with operations leaders evaluating AI-assisted workflow governance.",
  "primaryMessage": "Portarium helps teams research, create, approve, execute, and measure AI-assisted growth workflows with evidence attached to every Action.",
  "offer": "30-minute workflow governance review",
  "channels": ["email", "linkedin", "blog"],
  "tone": "direct, practical, evidence-backed",
  "requiredClaims": [
    "research outputs include source citations",
    "externally effectful Actions require approval",
    "measurement feeds the next governed loop"
  ],
  "prohibitedClaims": [
    "guaranteed revenue increase",
    "fully autonomous outbound without approval",
    "compliance certification not held by the workspace"
  ]
}
```

## OpenClaw Review

This spec was reviewed against the current OpenClaw tool-classification policy:

- `search:*`, `fetch:*`, `extract:*`, `analyze:*`, and `read:*` align with
  `ReadOnly` and can use `Auto` when policy allows.
- `create:*`, `send:*`, `publish:*`, and `update:*` align with `Mutation` and
  require `HumanApprove` under the current classifier.
- Any tool that cannot be classified by name is `Unknown` and requires
  `HumanApprove` before use.
- Tools in the `Dangerous` category are denied by the governance lifecycle and
  must not be used in this experiment.
- Outbound communication policy can elevate send or publish Actions from
  `HumanApprove` to `ManualOnly` or `Block` based on channel, fixture, and
  workspace policy.

The experiment must record the classifier input, classifier result, policy
decision, Approval Gate outcome, and final Action result as Evidence Artifacts
for every stage transition.
