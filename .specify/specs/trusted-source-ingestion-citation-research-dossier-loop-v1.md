# Trusted Source Ingestion, Citation, And Research Dossier Loop v1

**Status:** Proposed
**Bead:** bead-1099
**Extends:** [Decision Context Packet v1](./decision-context-packet-v1.md), [Agent Action Governance Lifecycle v1](./agent-action-governance-lifecycle-v1.md), [Agent Action Evidence Hooks v1](./agent-action-evidence-hooks-v1.md)
**Related ADRs:** [ADR-0035 Domain Atlas Research Pipeline](../../docs/internal/adr/0035-domain-atlas-research-pipeline.md), [ADR-0079 Derived Artifacts and Retrieval Architecture](../../docs/internal/adr/0079-derived-artifacts-retrieval-rag-vector-graph.md)

## Purpose

Define the governed research loop for Machines and agents that ingest external
or user-provided sources and turn them into cited internal artifacts for
content, software-building, micro-SaaS opportunity shaping, and showcase flows.

The loop prevents material without citations, stale material, or low-trust
material from silently driving autonomous execution. Any generated claim that
changes product direction, content positioning, workflow design, market
interpretation, or downstream Derived Artifact behavior must remain traceable to
source evidence.

## Scope

This specification applies when an autonomous builder:

- reads official docs, source repositories, public web pages, competitor
  material, or user-provided references;
- produces a research dossier, opportunity brief, content brief, showcase brief,
  or similar planning artifact;
- uses research output to create or modify a Derived Artifact, including specs,
  code, prompts, demos, campaign copy, sales enablement material, or generated
  media;
- asks for an Action, Approval Gate, Plan, or execution tier decision based on
  researched claims.

This specification does not make external sources authoritative for Portarium
state. Portarium stores, Evidence Log entries, and approved Plans remain the
authoritative records for execution and audit.

## Terms

| Term              | Meaning                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source Evidence   | A fetched, uploaded, or captured source payload plus metadata sufficient to re-identify and re-read it.                                                            |
| Source Snapshot   | The immutable Evidence Artifact that records what the agent actually consulted, including retrieval timestamp, locator, hash where available, and redaction state. |
| Research Dossier  | A governed artifact that synthesizes Source Evidence into cited claims, confidence, gaps, and recommendations.                                                     |
| Opportunity Brief | A Research Dossier profile focused on market, customer, competitor, pricing, workflow, or micro-SaaS shaping decisions.                                            |
| Claim Boundary    | The explicit scope, assumptions, and forbidden inferences for a generated claim.                                                                                   |
| Citation          | A stable pointer from a claim to one or more Source Snapshots or user-provided references.                                                                         |
| Provenance Chain  | The operator-visible path from Source Evidence to Research Dossier to Derived Artifact to any Run, Plan, Approval, or Action that used it.                         |

## Source Classes And Trust Ranking

Every consulted source must be classified before it can support a material
claim.

| Rank | Class                             | Examples                                                                                                                                               | Allowed Use                                                                                                                                                                                  |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Official versioned source         | Vendor docs, API reference, OpenAPI or GraphQL schema, release notes, official repo tags, official package metadata, legal or regulatory source        | May support material claims when fresh and within scope. Prefer over all lower ranks.                                                                                                        |
| T2   | Official but less stable source   | Official blog, changelog page without version anchors, official support article, official community answer by verified maintainer, public pricing page | May support material claims when re-read recently and not contradicted by T1.                                                                                                                |
| T3   | Public primary-adjacent source    | Source repo issue or pull request, community SDK, package README, standards discussion, benchmark published by the maintainer community                | May support implementation hypotheses or trend claims, but product/content direction needs corroboration or escalation.                                                                      |
| T4   | Third-party public source         | Independent blog, review site, analyst summary, competitor page, app marketplace listing, social proof page, public forum thread                       | May support market or content ideation only with visible confidence limits and corroboration. Cannot drive autonomous execution alone.                                                       |
| T5   | User-provided reference           | Uploaded files, pasted notes, interview transcripts, sales calls, internal strategy docs, operator instructions                                        | May define intent and workspace-specific context. Factual public claims still need external corroboration unless the user explicitly marks the reference as authoritative for the Workspace. |
| T6   | Generated or memory-only material | LLM output, cached summaries without source snapshots, agent memory, unlinked prior notes                                                              | Cannot support material claims. May only propose questions, search directions, or draft language labelled as not cited.                                                                      |

### Ranking Rules

1. Prefer the highest-rank source that directly covers the claim.
2. A lower-rank source may add interpretation, examples, or adoption signals, but
   it must not override a higher-rank source without escalation.
3. Competitor material is T4 even when it is an official competitor page,
   because it is authoritative only about the competitor's self-description, not
   about Portarium's market opportunity or customer outcomes.
4. User-provided references are authoritative for intent, constraints, and local
   business context only when the operator marks them as such.
5. Generated summaries are never sources. They are Derived Artifacts and must
   cite the Source Snapshots they summarize.
6. If a source mixes classes, classify each claim against the strongest specific
   evidence that supports that claim.

## Freshness And Re-Read Rules

A source has two freshness values:

- `retrievedAtIso`: when Portarium or the agent last captured the Source
  Snapshot.
- `freshnessRequiredBeforeIso`: the latest time at which the source must be
  re-read before it can support another material claim.

### Default Freshness Windows

| Source or Claim Type                                                                                                                | Re-read Before Acting                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pricing, packaging, plan limits, availability, terms, security posture, model capability, API behavior, legal or regulatory content | Same session, and never older than 7 days.                                             |
| Official docs, schemas, repos, release notes, compatibility matrices                                                                | Same session for implementation-affecting claims; otherwise never older than 30 days.  |
| Competitor positioning, public pages, app marketplace listings, review/ranking pages                                                | Same session for content or opportunity decisions; otherwise never older than 14 days. |
| Community issues, third-party blogs, forums, benchmarks                                                                             | Same session for material use; otherwise stale by default.                             |
| User-provided references                                                                                                            | Current for the Run unless the operator sets an expiry or superseding reference.       |
| Generated or memory-only material                                                                                                   | Not eligible; must be replaced by cited Source Evidence.                               |

### Mandatory Re-Read Triggers

An agent must re-read or refresh Source Evidence before acting when:

1. the claim affects product direction, technical implementation, outbound
   content, pricing, market positioning, legal posture, security posture, or an
   Approval Gate;
2. the source is outside its freshness window;
3. the source URL, repository ref, package version, or document revision is not
   pinned and the claim depends on current behavior;
4. another source conflicts with it;
5. the operator challenges the claim, asks for current evidence, or changes the
   goal;
6. a downstream Derived Artifact would be published externally or used to
   initiate autonomous execution.

## Source Snapshot Contract

Each Source Snapshot must capture enough metadata for audit and re-read. The
minimum contract is:

```json
{
  "schemaVersion": 1,
  "sourceSnapshotId": "source-snapshot-...",
  "workspaceId": "workspace_...",
  "runId": "run_...",
  "retrievedAtIso": "2026-05-03T00:00:00.000Z",
  "sourceClass": "T1",
  "locator": {
    "kind": "url | git | upload | paste | package | api",
    "uri": "https://example.com/docs",
    "pinnedRef": "commit, tag, version, ETag, content hash, or document revision when available"
  },
  "title": "Human-readable source title",
  "publisher": "Source owner or uploader",
  "licenseOrUseNote": "License, terms, or intake constraint when relevant",
  "hashSha256": "optional-content-hash",
  "redactionState": "none | redacted | rejected",
  "evidenceRef": "worm://...",
  "freshnessRequiredBeforeIso": "2026-05-10T00:00:00.000Z"
}
```

Source Snapshots are Evidence Artifacts. If a source cannot be stored in full
because of copyright, privacy, or license constraints, the snapshot must store a
minimal compliant excerpt, metadata, hash where possible, and enough locator
detail to re-read it.

## Research Dossier Contract

A Research Dossier is a Derived Artifact backed by Source Snapshots. It must be
stored with Evidence Log linkage and must be operator-visible before the dossier
can drive a material Plan, Approval, Action, or published artifact.

Minimum fields:

```json
{
  "schemaVersion": 1,
  "dossierId": "dossier_...",
  "workspaceId": "workspace_...",
  "runId": "run_...",
  "artifactKind": "research-dossier | opportunity-brief | content-brief | showcase-brief",
  "goal": "What decision or artifact this dossier supports",
  "scopeBoundary": {
    "inScope": ["claims the dossier is allowed to make"],
    "outOfScope": ["claims the dossier must not make"]
  },
  "sourceSnapshots": ["source-snapshot-..."],
  "claims": [
    {
      "claimId": "claim_...",
      "text": "Specific claim",
      "claimType": "fact | interpretation | recommendation | hypothesis | user-intent",
      "citations": ["source-snapshot-..."],
      "confidence": "high | medium | low | unknown",
      "confidenceRationale": "Why this confidence is assigned",
      "claimBoundary": "What this claim does and does not justify",
      "stalenessState": "fresh | stale | needs-reread",
      "conflictState": "none | unresolved | resolved",
      "allowedUses": ["ideation", "drafting", "planning", "approval-context", "execution-input"],
      "forbiddenUses": ["autonomous-execution"]
    }
  ],
  "openQuestions": ["Material gaps or unknowns"],
  "conflicts": ["Conflicting claims and source references"],
  "recommendedNextActions": [
    "request-more-evidence | escalate | draft-only | proceed-with-approval"
  ],
  "provenance": {
    "createdFromEvidenceRefs": ["worm://..."],
    "derivedArtifactRefs": ["artifact_..."],
    "decisionContextPacketRefs": ["packet_..."]
  }
}
```

### Claim Rules

1. Every material claim must cite at least one Source Snapshot.
2. A claim with no citation must be labelled `confidence: "unknown"` and
   forbidden from `approval-context` and `execution-input`.
3. A recommendation must cite both the facts it depends on and the inference
   boundary that limits it.
4. A claim supported only by T4 or T5 sources must be `medium` confidence at
   most unless the operator explicitly accepts the source as authoritative for
   the Workspace and the claim stays inside that authority boundary.
5. A claim supported only by T6 material must not appear as fact,
   recommendation, approval context, or execution input.
6. Conflicting claims must be preserved in the dossier. The agent may propose a
   resolution, but unresolved conflict must stay visible.

## Provenance Chain Requirements

Operators must be able to inspect provenance without reading raw logs.

The visible chain is:

```text
Source Evidence -> Source Snapshot -> Research Dossier claim -> Derived Artifact -> Plan/Approval/Run/Action
```

Each downstream Derived Artifact that uses dossier content must record:

- the dossier ID;
- the claim IDs used;
- the Source Snapshot IDs behind those claims;
- the transformation type, such as `summarized`, `quoted`, `inferred`,
  `rewritten`, `implemented`, or `published`;
- whether the downstream artifact changed any claim boundary or confidence;
- the Evidence Log entry and correlation ID for the transformation.

If a Derived Artifact cannot preserve this chain, it must be marked
`provenance-incomplete` and cannot be used for autonomous execution, external
publication, or Approval Gate context until rebuilt.

## Escalation Rules

Escalation is mandatory when an agent wants to act on material that is weak,
stale, conflicting, or not cited.

| Condition                                                                       | Required System Posture                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Material without citations supports a material claim                            | Block execution input; request more evidence or downgrade to draft-only.                                |
| Source is stale or must be re-read                                              | Block material use until refreshed, unless operator explicitly accepts stale context for ideation only. |
| T4-only competitor or public web material supports product or content direction | Require corroboration, operator acknowledgement, or approval-context warning.                           |
| User reference conflicts with official source                                   | Escalate to operator; preserve both claims and ask which authority boundary applies.                    |
| Sources conflict and no higher-rank source resolves it                          | Mark claim `conflictState: "unresolved"` and block autonomous execution.                                |
| License, terms, privacy, or copyright constraints are unclear                   | Store minimal metadata only, escalate for intake decision, and prevent copying into Derived Artifacts.  |
| Claim boundary is missing                                                       | Mark Decision Context Packet `insufficient` or `blocked` depending on blast radius.                     |
| Confidence is low and proposed use is execution input                           | Require Approval Gate with missing-evidence signal or deny autonomous path.                             |

Escalation outcomes must be recorded in the Evidence Log and reflected in any
Decision Context Packet as sufficiency state `insufficient` or `blocked` when
the evidence cannot yet support the requested action.

## Supported Loop Profiles

### Content Ideation

Content ideation may use T4 and T5 material for topic discovery, positioning
ideas, and draft outlines. Before content is published or used in outbound
campaigns, factual claims, comparative claims, pricing references, legal claims,
and security claims must cite fresh T1 or T2 evidence where available. T4-only
claims must be labelled as market signals or opinions, not facts.

### Micro-SaaS Opportunity Shaping

Opportunity Briefs must separate:

- customer pain or user intent from T5 references;
- competitor positioning from T4 references;
- feasibility and integration behavior from T1 or T2 technical sources;
- assumptions and hypotheses that require validation.

An opportunity recommendation may proceed to planning only when its material
claims have citations, confidence labels, and boundaries. Low-confidence or
uncorroborated opportunity claims may produce discovery tasks, not autonomous
implementation.

### Showcase Flows

Showcase briefs may use public pages, demos, screenshots, and user prompts to
shape narrative, but every product capability claim must trace to Portarium
specs, implemented behavior, Evidence Artifacts, or official source material.
Demo scripts and generated media must preserve provenance from cited claims to
the showcased Derived Artifact. Unverified claims may be used only as internal
storyboard placeholders.

## Decision Context Packet Integration

When a Research Dossier contributes to approval, steering, override, or Policy
change context, the Decision Context Packet must include:

- dossier ID and artifact kind;
- material claim IDs;
- sufficiency state for citations, freshness, confidence, and conflicts;
- missing evidence signals;
- claim boundaries and forbidden uses;
- provenance links to Source Snapshots and Derived Artifacts;
- allowed next actions, including `request-more-evidence`.

If any material claim lacks citations, is stale, conflict-unresolved, or outside
its boundary, the packet must not be `sufficient`.

## Acceptance Signals

- Generated claims that affect product direction, content direction, Approval
  Gates, Plans, Runs, or Actions are traceable to Source Snapshots.
- Material without citations or low-trust material cannot silently drive
  autonomous execution.
- Operators can inspect provenance from source to dossier to downstream Derived
  Artifact without raw-log archaeology.
- Weak, stale, conflicting, license-unclear, or not-cited material creates a
  visible escalation, missing-evidence signal, or blocked state.
- The same governed loop supports content ideation, micro-SaaS opportunity
  shaping, and showcase flows without changing the trust model.
