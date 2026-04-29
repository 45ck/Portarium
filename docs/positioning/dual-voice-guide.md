# Dual-Voice Documentation Guide

How to write Portarium docs that serve both normies and engineers without flattening either audience.

---

## Principle

**Lead with plain English. Let technical readers drill deeper.**

The first thing someone reads should make sense to a business owner. The architecture, contracts, and implementation details should be one click away for engineers who want them.

---

## The translation table

Use this when writing any user-facing docs. Left column is what engineers say internally. Right column is what goes in READMEs, landing pages, and introductory docs.

| Internal / technical                               | Public / plain English                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| Policy evaluation                                  | Checks the rules                                       |
| Policy evaluation before side effects              | Checks the rules before AI is allowed to do anything   |
| Evidence capture                                   | Keeps a record / paper trail                           |
| Evidence-first operation history                   | Full paper trail for every action                      |
| Approval workflows for human-in-the-loop execution | Risky actions still need human sign-off                |
| Blast radius                                       | How risky the action is                                |
| Systems of record                                  | Your existing tools / business software                |
| Connectors / ports and adapters                    | Works with the tools you already use                   |
| Governed execution                                 | Safe automation / AI that follows the rules            |
| Governed execution tiers                           | Trust levels (from fully manual to fully automatic)    |
| Control plane                                      | Safety layer                                           |
| Orchestration and state transitions                | Manages the flow of work                               |
| Workspace-scoped operations                        | Keeps projects separate                                |
| Immutable evidence                                 | Records that cannot be changed after the fact          |
| Execution mediation                                | Decides what is allowed to run                         |
| Domain events                                      | Activity log / notifications                           |
| Branded primitives                                 | (omit — internal implementation detail)                |
| Ports and adapters                                 | (omit from normie docs — say "connects to your tools") |

---

## Document layers

### Layer 1: Landing / README / homepage

**Audience**: Anyone. Business owners, managers, compliance, curious developers.

**Rules**:

- No jargon in the first three paragraphs
- Lead with the job Portarium does, not the mechanism
- Use concrete examples ("send this email," "update this record")
- Feature bullets use plain English from the translation table
- Architecture diagrams are welcome but captions should be plain English
- Link to Layer 2 for technical depth

**Example opening**:

> Portarium is an open-source safety and approval layer for AI agents. AI can draft, suggest, and prepare actions — but Portarium checks the rules, asks a human when needed, and keeps a full record of what happened.

### Layer 2: Explanation docs

**Audience**: Developers evaluating Portarium. Technical decision-makers.

**Rules**:

- Can use technical terms but define them on first use
- Architecture diagrams with technical labels are fine
- Reference domain model, API contracts, execution tiers by name
- Still frame the "why" in business terms before diving into "how"
- Link to Layer 3 for implementation details

**Example opening**:

> Portarium evaluates policy before any agent action reaches a target system. The control plane receives typed action proposals, evaluates them against workspace-scoped policy rules, and routes them through one of four execution tiers...

### Layer 3: Reference / API / internal docs

**Audience**: Engineers building on or contributing to Portarium.

**Rules**:

- Full technical precision
- Domain terms from the glossary used without translation
- Code examples, OpenAPI specs, type signatures
- No need to simplify — this audience chose to be here

**Example opening**:

> The `ApprovalGate` aggregate manages the lifecycle of a single approval decision. It receives `ApprovalRequested` domain events and transitions through `pending`, `approved`, `denied`, or `expired` states...

---

## Section-by-section guide for README

| Section             | Voice                         | Notes                                              |
| ------------------- | ----------------------------- | -------------------------------------------------- |
| Hero / tagline      | Plain English                 | "Let AI do the work. Keep humans in control."      |
| Why this exists     | Plain English                 | Frame as questions normies ask (who allowed this?) |
| What Portarium does | Plain English                 | Bullet list using translation table                |
| How it works        | Plain English with bold steps | Concrete examples, numbered flow                   |
| Before and after    | Plain English                 | Table with relatable "without" column              |
| Feature showcase    | Minimal captions              | Let the GIFs speak; one plain sentence each        |
| What you get        | Lightly technical             | Can name execution tiers but explain them          |
| Quickstart          | Technical                     | Developers only; commands and config               |
| Docs links          | Neutral                       | Just navigation                                    |
| Community           | Neutral                       | Links                                              |

---

## Common mistakes to avoid

### 1. Leading with architecture

Wrong: "Portarium is a hexagonal-architecture control plane with ports-and-adapters integration..."

Right: "Portarium checks the rules before AI is allowed to do anything. Under the hood, it uses a..."

### 2. Assuming the reader knows agent terminology

Wrong: "Portarium evaluates policy for agentic tool calls in governed execution runs."

Right: "When AI wants to do something — send an email, update a record, deploy a change — Portarium checks whether that action is allowed."

### 3. Using internal domain terms in public docs

Wrong: "The `WorkspaceId`-scoped `ApprovalGate` aggregate transitions on `ApprovalRequested` events..."

Right: "Each project has its own approval rules. When AI proposes an action, the system checks those rules..."

### 4. Explaining the mechanism before the outcome

Wrong: "Portarium uses four execution tiers (Auto, Assisted, HumanApprove, ManualOnly) to..."

Right: "You control how much freedom AI has. Start with full human oversight and widen autonomy as confidence grows. Four trust levels let you dial it in."

---

## The one rule

**Sell the outcome, not the mechanism.**

Normies buy "safe useful AI." Engineers discover the control plane underneath.

Both audiences get what they need. Neither is alienated by the other's language.
