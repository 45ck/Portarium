# T3 Code Architecture Deep Dive

**Bead:** bead-0966
**Date:** 2026-03-30
**Source:** `C:/Projects/t3code` (upstream: github.com/pingdotgg/t3code)

---

## 1. What is T3 Code?

T3 Code is a minimal web GUI for coding agents. It provides a unified interface
for running multiple AI provider backends (currently OpenAI Codex and Anthropic
Claude Agent) through a shared WebSocket-based protocol. It is built by the
Ping.gg team (creators of create-t3-app) and is very early stage.

**Key value proposition:** A single UI to manage multiple concurrent coding
agent sessions, each running in isolated threads with their own filesystem
checkpoints, proposed plans, and approval flows.

---

## 2. Architecture Overview

### 2.1 Monorepo Structure

```
t3code/
  apps/
    server/      -- Bun + Effect WebSocket server (the runtime brain)
    web/         -- React + Vite SPA (the UI)
    desktop/     -- Electron wrapper for native desktop experience
    marketing/   -- Marketing website
  packages/
    contracts/   -- Effect/Schema-based shared type contracts
    shared/      -- Shared runtime utilities (no barrel index, subpath exports)
```

**Build orchestration:** Turborepo (`turbo.json`)
**Package manager:** Bun v1.3.9+
**Runtime:** Node 24+ (server), Browser (web)
**Language:** TypeScript throughout, strict mode

### 2.2 Tech Stack

| Layer              | Technology                                                      |
| ------------------ | --------------------------------------------------------------- |
| Runtime            | Bun (server), Vite 8 (web dev server)                           |
| Type system        | Effect + Schema (domain modeling, DI, error handling)           |
| Server transport   | Raw WebSocket (`ws` package)                                    |
| State management   | Zustand (client), Effect ServiceMap (server)                    |
| Routing            | TanStack Router (file-based, `apps/web/src/routes/`)            |
| Editor             | Lexical (rich text composer for chat input)                     |
| Terminal           | xterm.js (`@xterm/xterm` + `@xterm/addon-fit`)                  |
| Diff rendering     | `@pierre/diffs`                                                 |
| UI framework       | React 19, Tailwind CSS 4, Lucide icons                          |
| Desktop            | Electron (via `apps/desktop/`)                                  |
| Testing            | Vitest 4, Effect Vitest integration, Playwright (browser tests) |
| Linting/formatting | oxlint + oxfmt (NOT ESLint/Prettier)                            |

### 2.3 Key Design Patterns

**Effect-TS everywhere (server):** The server uses the Effect library pervasively
for dependency injection (`ServiceMap.Service`), error typing (`Data.TaggedError`),
and composition (`Effect.fn`, `Effect.gen`). This gives the codebase strong
algebraic effect semantics -- errors, dependencies, and effects are all tracked
in the type system.

**Event sourcing (orchestration):** The orchestration domain follows a full CQRS
event-sourcing pattern:

- **Commands** (`OrchestrationCommand`) are validated through a **decider**
  (`orchestration/decider.ts`) that checks invariants and produces events
- **Events** (`OrchestrationEvent`) are persisted to an event store
  (`persistence/Services/OrchestrationEventStore.ts`)
- **Projections** rebuild read models from the event stream (multiple projection
  tables: threads, messages, activities, turns, sessions, proposed plans)
- **Read model** (`OrchestrationReadModel`) is the materialized view used for
  queries and invariant checks

**Provider adapter pattern:** AI provider backends implement a shared interface
(`ProviderAdapterShape<TError>`), allowing the system to swap between Codex and
Claude without changing orchestration logic. Adapters handle session lifecycle,
turn management, approval routing, and event streaming.

---

## 3. Core Modules

### 3.1 Orchestration (`apps/server/src/orchestration/`)

The heart of T3 Code. Manages the lifecycle of projects, threads, turns, and
messages through event sourcing.

**Key services:**

- `OrchestrationEngine` -- Accepts commands, runs them through the decider,
  persists events, updates projections
- `OrchestrationReactor` -- Reacts to orchestration events (e.g., starting
  provider sessions when a turn is requested)
- `ProviderCommandReactor` -- Translates provider runtime events into
  orchestration commands (bridging the provider layer to the orchestration layer)
- `ProviderRuntimeIngestion` -- Ingests raw provider runtime events and
  normalises them into canonical event format
- `ProjectionPipeline` -- Rebuilds all read model projections from the event
  stream

**Domain model (from contracts):**

- `OrchestrationProject` -- workspace with title, cwd, scripts, model selection
- `OrchestrationThread` -- conversation thread with runtime mode, interaction mode,
  messages, proposed plans, session status
- `OrchestrationMessage` -- user/assistant/system messages with attachments
- `OrchestrationProposedPlan` -- agent-generated plan with markdown content,
  implementation tracking (`implementedAt`, `implementationThreadId`)

### 3.2 Provider Layer (`apps/server/src/provider/`)

Abstracts AI provider differences behind a uniform adapter interface.

**Adapters:**

- `CodexAdapter` / `CodexProvider` -- Wraps Codex CLI app-server (JSON-RPC over
  stdio). Sessions are started as child processes.
- `ClaudeAdapter` / `ClaudeProvider` -- Uses `@anthropic-ai/claude-agent-sdk`.

**Provider adapter contract (`ProviderAdapterShape`):**

- `startSession(input)` -- Start a provider session
- `sendTurn(input)` -- Send a user turn
- `interruptTurn(threadId)` -- Interrupt an active turn
- `respondToRequest(threadId, requestId, decision)` -- Respond to approval request
- `respondToUserInput(threadId, requestId, answers)` -- Respond to user input request
- `stopSession(threadId)` -- Stop session
- `rollbackThread(threadId, numTurns)` -- Roll back N turns
- `streamEvents` -- Stream of `ProviderRuntimeEvent`

### 3.3 Checkpointing (`apps/server/src/checkpointing/`)

Filesystem checkpoint management using hidden Git refs. Captures workspace state
at turn boundaries so users can revert to any previous turn.

**Key contract (`CheckpointStoreShape`):**

- `captureCheckpoint(cwd, checkpointRef)` -- Snapshot workspace via isolated Git index
- `restoreCheckpoint(cwd, checkpointRef)` -- Restore workspace to a checkpoint
- `diffCheckpoints(from, to)` -- Compute patch between checkpoints
- `deleteCheckpointRefs(refs)` -- Clean up checkpoint refs

### 3.4 Persistence (`apps/server/src/persistence/`)

SQLite-backed (via `@effect/sql-sqlite-bun`) storage for all state:

- `OrchestrationEventStore` -- Event log
- `OrchestrationCommandReceipts` -- Command idempotency
- Projection tables: Projects, Threads, Messages, Activities, Turns, Sessions,
  ProposedPlans, PendingApprovals

### 3.5 WebSocket Server (`apps/server/src/wsServer/`)

JSON-RPC-style WebSocket protocol connecting the web UI to the server:

- **Methods** (request/response): `orchestration.dispatch`, `git.*`,
  `terminal.*`, `server.*`, `projects.*`
- **Channels** (server push): `orchestration.domainEvent`,
  `git.actionProgress`, `terminal.event`, `server.welcome`

### 3.6 Terminal (`apps/server/src/terminal/`)

PTY-backed terminal emulator using `node-pty`. Each terminal session is
connected to the web UI via the WebSocket push channel.

---

## 4. Approval Model

T3 Code has a built-in approval system that maps closely to Portarium's concepts:

### 4.1 Runtime Modes

```typescript
RuntimeMode = 'approval-required' | 'full-access';
```

- **full-access:** `approvalPolicy: "never"`, `sandboxMode: "danger-full-access"`
- **supervised (approval-required):** `approvalPolicy: "on-request"`,
  `sandboxMode: "workspace-write"`, prompts in-app for command/file approvals

### 4.2 Approval Policy

```typescript
ProviderApprovalPolicy = 'untrusted' | 'on-failure' | 'on-request' | 'never';
```

### 4.3 Sandbox Modes

```typescript
ProviderSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
```

### 4.4 Approval Flow

1. Provider requests approval (`request.opened` event with type
   `command_execution_approval`, `file_read_approval`, `file_change_approval`,
   `apply_patch_approval`, `exec_command_approval`)
2. Web UI renders approval prompt in the chat thread
3. User responds: `accept`, `acceptForSession`, `decline`, `cancel`
4. Server calls `adapter.respondToRequest(threadId, requestId, decision)`
5. Provider resumes or aborts the operation

### 4.5 Proposed Plans

Agents can emit proposed plans (`thread.proposed-plan.upsert` command). Plans
contain markdown describing what the agent intends to do. Users can:

- Review the plan in-UI
- Accept and "implement" (creates a new thread with `sourceProposedPlan` reference)
- Modify the plan text before implementing
- Download as markdown file

---

## 5. What T3 Code Exposes for Integration

### 5.1 WebSocket Protocol

The primary integration surface. Any external system can connect via WebSocket
and dispatch orchestration commands or subscribe to events. The protocol is
JSON-RPC with typed schemas defined in `@t3tools/contracts`.

### 5.2 Provider Adapter Interface

A new provider adapter could be written that wraps tool calls through Portarium
before forwarding to the actual AI provider. This is the most natural
integration point.

### 5.3 Orchestration Event Stream

All domain events flow through the `orchestration.domainEvent` WebSocket
channel. An external listener could subscribe to these events for audit trails,
compliance logging, or external governance triggers.

### 5.4 Approval Request/Response Protocol

The `request.opened` / `respondToRequest` flow is the in-app approval mechanism.
Portarium could intercept or augment this flow.

---

## 6. Portarium Governance Overlay Design

### 6.1 Integration Strategy: Provider Adapter Proxy

The most architecturally clean approach is a **governance proxy adapter** that
wraps an existing provider adapter:

```
User -> T3 Code -> PortariumGovernanceAdapter -> CodexAdapter/ClaudeAdapter
                          |
                          v
                    Portarium Control Plane
                    (policy eval, approval routing)
```

**How it works:**

1. `PortariumGovernanceAdapter` implements `ProviderAdapterShape`
2. On `sendTurn`, it inspects the turn for tool calls
3. Before forwarding to the inner adapter, it calls Portarium's
   `/agent-actions:propose` endpoint for each tool call
4. If Portarium returns `NeedsApproval`, the adapter emits a `request.opened`
   event that T3 Code's approval UI can render -- but routes the actual
   decision through Portarium's approval system (cockpit, operator queue)
5. Once Portarium approves, the adapter forwards the original turn to the
   inner provider adapter

**Advantages:**

- Zero changes to T3 Code's orchestration or UI layers
- Portarium's approval queue, audit trail, and policy engine are authoritative
- T3 Code's existing approval UI could show Portarium approval status
- Multiple T3 Code instances can share the same Portarium governance tenant

### 6.2 Alternative: Orchestration Event Sidecar

A lighter-weight approach: subscribe to the `orchestration.domainEvent` WebSocket
channel and react to events externally.

- Listen for `thread.turn-start-requested` events
- POST to Portarium for policy evaluation
- If denied, dispatch a `thread.turn.interrupt` command back through the WebSocket
- If needs approval, hold the interrupt until Portarium approval is granted

**Disadvantages:** Race conditions (turn may execute before interrupt arrives),
no per-tool-call granularity, requires the WebSocket to be exposed to Portarium.

### 6.3 Concept Mapping

| T3 Code Concept                  | Portarium Concept                                      |
| -------------------------------- | ------------------------------------------------------ |
| `Thread`                         | `Run` (governed execution context)                     |
| `OrchestrationProject`           | `Workspace` (tenant scope)                             |
| `ProviderApprovalPolicy`         | `ExecutionTier` (Auto/Assisted/HumanApprove)           |
| `request.opened` (approval)      | `AgentActionProposal` (pre-execution gate)             |
| `respondToRequest(accept)`       | `ApprovalGranted` decision                             |
| `respondToRequest(decline)`      | `ApprovalDenied` decision                              |
| `OrchestrationProposedPlan`      | Plan-level governance (Portarium run plan review)      |
| `CheckpointStore`                | Evidence chain (immutable audit of state at each turn) |
| `ProviderRuntimeEvent` stream    | CloudEvents (external choreography)                    |
| `RuntimeMode: approval-required` | `ExecutionTier: HumanApprove`                          |
| `RuntimeMode: full-access`       | `ExecutionTier: Auto`                                  |
| `ProviderSandboxMode`            | Portarium sandbox containment (ADR-0070)               |

---

## 7. Existing Integration Points in Portarium

No direct references to T3 Code exist in the Portarium codebase today. The only
mention is in `.beads/issues.jsonl` (this research bead).

However, several Portarium subsystems are designed for exactly this kind of
integration:

1. **OpenClaw Plugin (`packages/portarium/`)** -- The plugin pattern
   (before_tool_call hook, approval polling, capability lookup) maps directly
   to T3 Code's `ProviderAdapter.respondToRequest` flow. A T3 Code adapter
   plugin could reuse the same `PortariumClient` and `ApprovalPoller`.

2. **Control Plane `/agent-actions:propose`** -- The HTTP API for policy
   evaluation is provider-agnostic. T3 Code's governance adapter would call
   this endpoint with `toolName` and `parameters`.

3. **SDK `agentActions` namespace** -- The TypeScript SDK
   (`src/infrastructure/sdk/portarium-client.ts`) provides typed methods for
   proposal and polling, usable from a T3 Code server-side adapter.

4. **CloudEvents / SSE Event Stream** -- Portarium broadcasts approval decisions
   as CloudEvents. A T3 Code adapter could subscribe to these for real-time
   approval status rather than polling.

---

## 8. Recommendations

1. **Start with a PortariumGovernanceAdapter** that wraps CodexAdapter. This is
   the cleanest integration path with zero changes to T3 Code core.

2. **Map RuntimeMode to Portarium ExecutionTier** so that when a T3 Code user
   selects "supervised", the Portarium governance layer activates automatically.

3. **Bridge T3 Code's proposed plans to Portarium run plans** for plan-level
   governance (review before implementation begins).

4. **Feed T3 Code's checkpoint data into Portarium's evidence chain** for
   immutable audit of what the agent did at each turn boundary.

5. **Consider bidirectional UI**: T3 Code's approval UI for real-time developer
   flow, Portarium Cockpit for operator oversight and batch review.
