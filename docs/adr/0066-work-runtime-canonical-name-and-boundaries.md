# ADR-0066: WorkRuntime as the Canonical Runtime Name and Boundary

**Beads:** bead-wmci-runtime-adr
**Status:** Accepted
**Date:** 2026-04-05

## Context

Portarium already has a clear architectural split between the control plane and the execution plane.

- `docs/explanation/architecture.md` defines the runtime split between control-plane HTTP/governance responsibilities and execution-plane worker behavior.
- ADR-0065 establishes that Portarium remains the governable control plane while external and isolated runtimes perform execution work.

The new work model introduces three first-class Work Item kinds:

- `case`
- `change`
- `investigation`

That model also introduces a managed execution environment primarily for `change` work and optionally for `investigation` work. Until now, the product language and internal naming have several competing candidates:

- `MissionRuntime`
- `ExecutionCell`
- `DevWorkspace`
- `WorkRuntime`
- informal references to “browser”, “live browser”, or “embedded browser”

This is a problem for four reasons:

1. **Naming drift** — engineering, docs, and UI can diverge.
2. **Boundary drift** — teams may accidentally treat the browser as the top-level primitive when it is only one child surface.
3. **Scope confusion** — `DevWorkspace` is too software-specific, while Portarium also governs investigation and operations-adjacent execution.
4. **Product confusion** — “MissionRuntime” and “ExecutionCell” are expressive internally but less obvious as durable product language.

We need one canonical term that works across architecture, API, docs, and UI.

## Decision

Adopt **WorkRuntime** as the canonical name for the managed execution environment associated with a Work Item.

### Definition

A **WorkRuntime** is a managed, isolated, policy-aware execution environment scoped to a single Work Item and used to perform execution-plane tasks under Portarium governance.

### Canonical rules

1. The top-level primitive is **WorkRuntime**, not browser, not terminal, and not preview.
2. A WorkRuntime is a child of governed work, not a peer to the control plane.
3. Browser and terminal sessions are child resources of a WorkRuntime.
4. `change` work is the primary runtime-heavy work kind.
5. `investigation` work may optionally use a WorkRuntime.
6. `case` work normally does not require a full WorkRuntime, though light managed execution contexts may still exist behind adapters.

## Why WorkRuntime

### Rejected: `DevWorkspace`

Rejected because it incorrectly narrows the concept to software development. Portarium must support runtime-backed investigations and future runtime-backed non-dev tasks.

### Rejected: `MissionRuntime`

Rejected as the primary term because it is more branded than descriptive. It may be acceptable as a UI label for a future premium surface, but not as the canonical architecture/API term.

### Rejected: `ExecutionCell`

Rejected because it is precise but too infrastructure-flavoured for broad product use. It is harder to explain to users and less obviously tied to work.

### Accepted: `WorkRuntime`

Accepted because it:

- is plain and durable,
- maps directly to the Work Item model,
- works for code, browser, preview, QA, and investigation use cases,
- is neutral about local vs cloud execution,
- is easy to carry into API/resource names.

## Responsibilities

A WorkRuntime is responsible for:

- isolated execution for a single Work Item,
- resource lifecycle (`provisioning`, `ready`, `busy`, `paused`, `failed`, `terminated`),
- terminal session hosting,
- browser session hosting,
- preview/dev-server exposure,
- snapshot/artifact capture,
- resumability and crash recovery hooks,
- policy-aware routing of risky actions back through Portarium,
- emitting evidence references and execution metadata back to the control plane.

## Non-responsibilities

A WorkRuntime is **not**:

- the control plane,
- a workspace or project container,
- the source of truth for approvals, policy, or audit,
- the browser itself,
- a substitute for repos, CRMs, or systems of record,
- a guarantee that work is safe without policy enforcement.

## Resource Model

### Top-level resource

```ts
export type WorkRuntimeStatus =
  | 'provisioning'
  | 'ready'
  | 'busy'
  | 'paused'
  | 'failed'
  | 'terminated'

export interface WorkRuntime {
  id: string
  workspaceId: string
  projectId?: string
  workItemId: string
  status: WorkRuntimeStatus
  resourceProfile: 'small' | 'medium' | 'large'
  repoUrl?: string
  branch?: string
  workspacePath?: string
  devServerUrl?: string
  terminalSessionIds: string[]
  browserSessionIds: string[]
  artifactIds: string[]
  snapshotIds: string[]
  createdAt: string
  updatedAt: string
}
```

### Child resources

```ts
export interface BrowserSession {
  id: string
  runtimeId: string
  role: 'app-preview' | 'research' | 'qa' | 'admin' | 'generic'
  controlMode: 'agent' | 'human' | 'shared'
  status: 'starting' | 'active' | 'idle' | 'crashed'
  liveViewUrl?: string
  recordingUrl?: string
}

export interface TerminalSession {
  id: string
  runtimeId: string
  purpose: 'build' | 'test' | 'server' | 'generic'
  status: 'starting' | 'active' | 'idle' | 'exited' | 'failed'
  liveStreamUrl?: string
}
```

## Boundary Rules

### Control plane boundary

Portarium remains the source of truth for:

- work identity,
- policy evaluation,
- approval state,
- run coordination,
- evidence linkage,
- auditability,
- user-visible governance state.

### Execution plane boundary

WorkRuntime remains the place where:

- tools execute,
- files change,
- commands run,
- previews are rendered,
- browser QA occurs,
- artifacts are produced.

### Crucial invariant

A WorkRuntime may execute work, but it must not become the authority for whether that work was allowed.

## Naming Rules Across the Repo

Use **WorkRuntime** in:

- ADRs and architecture docs,
- domain/application type names,
- API schema/resource names,
- evidence payload summaries,
- Cockpit technical copy where a concrete resource is being shown.

Use **runtime** in user-facing shorthand only when the context is already clear.

Do **not** use these as canonical synonyms:

- `DevWorkspace`
- `MissionRuntime`
- `ExecutionCell`
- `BrowserRuntime`

## Consequences

**Positive:**

- One stable term across docs, API, and UI.
- Cleaner boundary between governance and execution.
- Prevents browser-first modelling mistakes.
- Keeps the work model broad enough for more than software delivery.

**Negative:**

- Existing docs/specs using alternative terms will need cleanup.
- Some users may still need “runtime” explained in onboarding/product copy.

## Implementation Mapping

This ADR maps directly to:

- `bead-wmci-change-runtime` — concrete Change runtime lifecycle.
- `bead-wmci-cockpit-ia` — kind-aware Cockpit surfaces that show runtime-backed work correctly.
- `bead-wmci-copy-docs` — documentation and product language cleanup.

## Acceptance Evidence

This decision is considered accepted when:

1. new architecture/spec docs use **WorkRuntime** as the canonical term,
2. work-model specs describe browser/terminal as child resources rather than top-level primitives,
3. future API/OpenAPI deltas use `WorkRuntime`-based resource names,
4. no newly added core docs introduce competing canonical terms.

## Remaining Gaps

- Define the concrete WorkRuntime lifecycle/state machine and supervisor protocol.
- Define runtime provisioning and teardown semantics for local-first execution.
- Define how WorkRuntime surfaces are exposed in Cockpit for `change` and optional `investigation` work.
