# Spec: Growth Studio Experiment Definition + Agent Personas (v1)

**Epic:** bead-0999
**Spec slice:** bead-1001
**Related beads:** bead-1003 (tool registry), bead-1005 (approval policy), bead-1008, bead-1010, bead-1014, bead-1018, bead-1020, bead-1021, bead-1022, bead-1025, bead-1026

## Context

Portarium needs a live, end-to-end experiment that shows governed agent work in a business domain people
immediately understand. The Growth Studio experiment demonstrates three cooperating agent personas that:

1. research target accounts and contacts
2. plan campaign angles and outreach hypotheses
3. draft content and outreach assets
4. request approval through Cockpit
5. execute approved actions
6. measure outcomes and feed the next loop

The experiment must use Portarium's existing governance vocabulary and OpenClaw tool-classification model:

- `ReadOnly` tools map to `Auto`
- `Mutation` tools map to `HumanApprove`
- `Dangerous` tools map to `ManualOnly`
- unknown tools default to `HumanApprove`

## Persona Model

### Persona 1 — Researcher

**Goal**
Identify high-fit prospects, gather public context, and produce a prospect dossier that can be used for
campaign planning without mutating external systems by default.

**Owned stages**

- `research`
- `plan` (initial segmentation and outreach hypothesis)

**Primary tools**

| Tool                 | Category   | Minimum tier   | Why it exists                                                                   |
| -------------------- | ---------- | -------------- | ------------------------------------------------------------------------------- |
| `web-search`         | `ReadOnly` | `Auto`         | Search public web sources for company, funding, hiring, and product signals.    |
| `scrape-website`     | `ReadOnly` | `Auto`         | Extract public website text for messaging and positioning context.              |
| `read-crm-contact`   | `ReadOnly` | `Auto`         | Avoid duplicate outreach by checking existing CRM coverage and account history. |
| `read-analytics`     | `ReadOnly` | `Auto`         | Pull prior campaign performance to inform targeting and angle selection.        |
| `update-crm-contact` | `Mutation` | `HumanApprove` | Optionally add a research note or score back to CRM once human-reviewed.        |

**Outputs**

- `ProspectResearchOutput`
- `CampaignPlanDraft`

### Persona 2 — ContentCreator

**Goal**
Turn the approved research and plan into channel-specific draft assets that are ready for operator review.

**Owned stages**

- `create`

**Primary tools**

| Tool                  | Category   | Minimum tier   | Why it exists                                                                    |
| --------------------- | ---------- | -------------- | -------------------------------------------------------------------------------- |
| `draft-email`         | `Mutation` | `HumanApprove` | Create a saved outreach email draft for a specific contact or segment.           |
| `draft-linkedin-post` | `Mutation` | `HumanApprove` | Create a LinkedIn thought-leadership draft tied to the campaign theme.           |
| `draft-blog-article`  | `Mutation` | `HumanApprove` | Generate a blog article draft for the niche media engine side of the experiment. |
| `schedule-content`    | `Mutation` | `HumanApprove` | Queue approved content into a publishing backlog without publishing it live.     |

**Outputs**

- `ContentDraftBundle`
- `ApprovalPackage` for human review

### Persona 3 — OutreachExecutor

**Goal**
Execute approved outreach and publishing actions, write back execution receipts, and gather measurement data
for the next iteration.

**Owned stages**

- `execute`
- `measure`

**Primary tools**

| Tool                    | Category    | Minimum tier   | Why it exists                                                           |
| ----------------------- | ----------- | -------------- | ----------------------------------------------------------------------- |
| `send-email`            | `Dangerous` | `ManualOnly`   | Send an external email after human review and explicit operator action. |
| `publish-linkedin-post` | `Dangerous` | `ManualOnly`   | Publish to a live external channel with operator initiation.            |
| `publish-blog-article`  | `Dangerous` | `ManualOnly`   | Publish a blog article to the live site.                                |
| `update-crm-contact`    | `Mutation`  | `HumanApprove` | Record outreach status, notes, or next-step metadata back into CRM.     |
| `read-analytics`        | `ReadOnly`  | `Auto`         | Measure opens, replies, traffic, and engagement after execution.        |

**Outputs**

- `ExecutionReceiptBundle`
- `MetricsSnapshot`
- `IterationBrief`

## Business Loop

| Stage      | Owner                     | Purpose                                                     | Primary input                                 | Primary output                      |
| ---------- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------- | ----------------------------------- |
| `research` | `Researcher`              | Discover and qualify target accounts and contacts.          | `ResearchInput`                               | `ProspectResearchOutput`            |
| `plan`     | `Researcher`              | Convert research into segment hypotheses and channel plans. | `ProspectResearchOutput`                      | `CampaignPlanDraft`                 |
| `create`   | `ContentCreator`          | Produce channel-specific assets and saved drafts.           | `CampaignPlanDraft`, `ContentBrief`           | `ContentDraftBundle`                |
| `approve`  | Human operator in Cockpit | Review proposed drafts and execution requests.              | `ApprovalPackage`                             | `ApprovalDecisionOutput`            |
| `execute`  | `OutreachExecutor`        | Carry out approved sends, publishing, and CRM updates.      | `ApprovedExecutionRequest`                    | `ExecutionReceiptBundle`            |
| `measure`  | `OutreachExecutor`        | Evaluate response signals and recommend the next iteration. | `ExecutionReceiptBundle`, `MeasurementWindow` | `MetricsSnapshot`, `IterationBrief` |

## Input / Output Contracts

### `ResearchInput`

- `workspaceId`: `WorkspaceId`
- `campaignGoal`: short natural-language objective
- `icp`: `IdealCustomerProfile`
- `maxProspects`: integer > 0
- `historyWindowDays`: integer > 0

### `ProspectResearchOutput`

- `accounts[]`: target account summaries with industry, size, recent signals, and source links
- `contacts[]`: target people with role, confidence, and public evidence
- `exclusionReasons[]`: accounts or contacts filtered out and why
- `recommendedAngles[]`: initial messaging hypotheses tied to evidence

### `CampaignPlanDraft`

- `segmentId`
- `campaignTheme`
- `channelMix[]`: one or more of `email`, `linkedin`, `blog`
- `targetContacts[]`
- `estimatedBudgetUsd`
- `successMetrics[]`
- `riskNotes[]`

### `ContentBrief`

- `campaignTheme`
- `audienceProblem`
- `callToAction`
- `channel`
- `tone`
- `proofPoints[]`
- `forbiddenClaims[]`

### `ContentDraftBundle`

- `drafts[]`: zero or more email, LinkedIn, or blog drafts
- `draftMetadata[]`: owning persona, channel, target audience, and proposed tier
- `crmPatch?`: optional research-note or status patch
- `readyForApproval`: boolean

### `ApprovalPackage`

- `proposalId`
- `persona`
- `toolName`
- `requiredTier`
- `rationale`
- `draftSummary`
- `supportingEvidenceRefs[]`

### `ApprovalDecisionOutput`

- `approvalId`
- `status`: `Pending` | `Approved` | `Denied` | `Expired`
- `decidedByUserId?`
- `decisionRationale?`

### `ApprovedExecutionRequest`

- `approvalId`
- `toolName`
- `parameters`
- `approvedByUserId`
- `approvedAtIso`

### `ExecutionReceiptBundle`

- `receipts[]`: send/publish/update confirmations
- `externalRefs[]`: links to CRM records, sent message IDs, or published URLs
- `failures[]`: any denied, expired, or manual follow-up items

### `MetricsSnapshot`

- `windowStartIso`
- `windowEndIso`
- `proposedCount`
- `approvedCount`
- `executedCount`
- `replyCount`
- `engagementCount`
- `conversionRate`

### `IterationBrief`

- `winningAngles[]`
- `losingAngles[]`
- `nextSegments[]`
- `policyEscalations[]`
- `operatorFeedback[]`

## Approval Checkpoints

| Stage      | Typical tools                                                                  | Default checkpoint                                                                               |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `research` | `web-search`, `scrape-website`, `read-crm-contact`, `read-analytics`           | No human checkpoint; `ReadOnly` actions run at `Auto`.                                           |
| `plan`     | no external side effects by default                                            | No checkpoint when the agent only synthesizes an internal plan artifact.                         |
| `create`   | `draft-email`, `draft-linkedin-post`, `draft-blog-article`, `schedule-content` | Human checkpoint required; draft creation and queueing are `Mutation` actions at `HumanApprove`. |
| `approve`  | operator decision in Cockpit                                                   | Human checkpoint is explicit. Maker-checker always applies.                                      |
| `execute`  | `send-email`, `publish-linkedin-post`, `publish-blog-article`                  | Explicit operator action required; live publishing and sending are `ManualOnly`.                 |
| `measure`  | `read-analytics`, optional `update-crm-contact`                                | Analytics reads stay `Auto`; any CRM mutation remains `HumanApprove`.                            |

## Escalation Assumptions For The Experiment

These are experiment-shaping assumptions that the later policy bead must formalize:

1. `draft-*` tools are treated as `HumanApprove`.
2. `send-*` and `publish-*` tools are treated as `ManualOnly`.
3. Batch actions affecting more than five contacts escalate to `ManualOnly`.
4. Any plan with `estimatedBudgetUsd > 50` escalates to `ManualOnly`.
5. The proposing persona cannot approve its own action.
6. Publish approval must not be granted by the same approver who approved the draft when a distinct-approver rule applies.

## Sample Ideal Customer Profile

### `sample-icp-saas`

- `name`: `Series A-C developer-tools SaaS`
- `industries`: `SaaS`, `developer-tools`, `AI infrastructure`
- `companySize`: `50-500 employees`
- `roles`: `VP Engineering`, `CTO`, `Head of Platform`
- `buyingSignals[]`:
  - recent funding announcement
  - hiring for platform, data, or AI roles
  - migration away from incumbent tooling
- `exclusions[]`:
  - no public product team
  - company size < 20 employees
  - active existing opportunity in CRM

## Sample Content Brief

### `content-brief-outreach-email`

- `campaignTheme`: `Governing AI agents without slowing down GTM teams`
- `channel`: `email`
- `audienceProblem`: `Outbound and content workflows are fragmented across CRM, publishing, and approval tools.`
- `callToAction`: `Invite the prospect to a 20-minute workflow review.`
- `tone`: `credible, technical, concise`
- `proofPoints[]`:
  - governed approvals for external mutations
  - evidence chain and auditability
  - integration with existing CRM and publishing systems
- `forbiddenClaims[]`:
  - guaranteed revenue uplift
  - unverified customer logos
  - false urgency or fabricated social proof

## Review Signal

- This spec is aligned to the current OpenClaw classification vocabulary in `.specify/specs/openclaw-tool-blast-radius-policy-v1.md`.
- This spec is aligned to the propose/approve/execute lifecycle in `.specify/specs/agent-action-governance-lifecycle-v1.md`.
- The follow-on beads must implement the registry and policy semantics described here without renaming the three personas or the six loop stages.

## Acceptance

1. The spec file exists at `.specify/specs/growth-studio-experiment-v1.md`.
2. The spec defines the three required personas: `Researcher`, `ContentCreator`, and `OutreachExecutor`.
3. Each persona has at least three named tools with explicit category and tier expectations.
4. The business loop stages are defined as `research`, `plan`, `create`, `approve`, `execute`, and `measure`.
5. Input/output contracts are defined for the stage-to-stage transfers.
6. A sample ICP and a sample content brief are included.
7. Approval checkpoints are explicit per stage and use the existing `Auto`, `HumanApprove`, and `ManualOnly` vocabulary.
