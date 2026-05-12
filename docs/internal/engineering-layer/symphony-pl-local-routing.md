# Governed Symphony, Prompt Language, and Local Model Routing

Status: R&D direction
Date: 2026-05-12
Tracking bead: `bead-1225`
Companion prompt-language bead: `prompt-language-gslr`

This note captures the next architecture step for the governed engineering
layer: combine the OpenAI Symphony pattern, prompt-language execution contracts,
and local/frontier model routing into one Portarium-controlled engineering
system.

## Thesis

Portarium should become a governed engineering control plane:

```text
Cockpit / Beads board
  -> Symphony-style scheduler
  -> prompt-language execution contract
  -> local bulk agents plus Codex/frontier escalation
  -> Portarium approval, evidence, and policy loop
```

The product is not "an AI kanban board" and not "a better coding model." It is
the system that lets humans manage governed engineering work while agents do the
bounded execution.

Humans should curate intent, approve risky plans and merges, calibrate policy,
and inspect evidence. Agents should triage, plan, implement, repair, and review
inside explicit policy and evidence boundaries.

## Source facts

OpenAI Symphony is the closest public reference shape. Its core idea is that a
project-management board becomes the control plane for coding agents: the
orchestrator watches active tasks, creates one isolated workspace per issue, and
keeps an agent running for eligible work until the workflow reaches a handoff
state. The public spec frames Symphony as a scheduler/runner, not a full
workflow engine or dashboard:

- OpenAI post: <https://openai.com/index/open-source-codex-orchestration-symphony/>
- Symphony spec: <https://github.com/openai/symphony/blob/main/SPEC.md>

Codex App Server is the stronger integration seam than a terminal session. It is
a headless JSON-RPC/JSONL protocol with thread and turn lifecycle methods,
approval policy fields, cwd/sandbox settings, event streaming, auth state, and
rate-limit surfaces:

- Codex App Server docs: <https://developers.openai.com/codex/app-server>

OpenAI gpt-oss makes the local-worker lane strategically relevant. The open
weights are not served through the OpenAI API, can run on infrastructure we
control, and are compatible with local stacks such as Ollama, vLLM, and
llama.cpp. Ollama exposes an OpenAI-compatible local API, which means local
models can often sit behind existing OpenAI-shaped client code:

- gpt-oss overview: <https://help.openai.com/en/articles/11870455>
- gpt-oss with Ollama: <https://developers.openai.com/cookbook/articles/gpt-oss/run-locally-ollama>

## What we are building

We are building a governed version of Symphony for Portarium.

Symphony says:

```text
For every open task, guarantee that an agent is running in its own workspace.
```

Portarium should say:

```text
For every approved engineering bead, guarantee that the right worker lane is
running in an isolated workspace, with every consequential action routed through
policy, approval, and evidence.
```

Prompt-language is the execution contract inside each bead. It owns:

- decomposition into bounded steps
- local/frontier lane selection
- deterministic gates
- retry loops
- artifact requirements
- escalation triggers
- final review requirements

Portarium owns:

- task state
- actor identity
- policy tier resolution
- approvals
- evidence chain
- sandbox/workspace lifecycle
- Cockpit operator state
- auditability and SoD

Codex/OpenAI frontier models own:

- writing and revising PL contracts
- high-ambiguity planning
- architecture and security decisions
- root-cause repair after local failure
- final review

Local models own:

- repo inventory
- boilerplate
- documentation drafts
- fixture generation
- verifier-named narrow repairs
- low-risk repetitive edits
- cheap exploration and summary work

## Existing Portarium fit

The current repo already has most of the control-plane vocabulary:

| Need                        | Existing primitive                                                   |
| --------------------------- | -------------------------------------------------------------------- |
| Board card / Symphony issue | `WorkItemV1` with links to runs, workflows, approvals, and evidence  |
| Execution attempt           | `RunV1` with workflow, status, control state, owner, charter         |
| Approval checkpoint         | `ApprovalV1` and approval packets                                    |
| Human routing               | `HumanTaskV1`, workforce queues, workforce capabilities              |
| Evidence spine              | `EvidenceEntryV1`, `ArtifactV1`, evidence chain verifier             |
| Workflow                    | `WorkflowV1` with port family/capability actions and execution tiers |
| Engineering surface         | Cockpit engineering routes and bead projections                      |
| Intent decomposition        | `ProjectIntentV1`, `BeadProposalV1`, `bead-planner`                  |
| Extension boundary          | Cockpit extension SDK with governed-action semantics                 |

The gap is not vocabulary. The gap is a first-class engineering run contract that
materializes the full loop:

```text
intent -> bead plan -> workspace -> PL run -> local/frontier lanes -> gates
-> approvals -> evidence -> review -> merge/handoff
```

## Existing prompt-language fit

prompt-language already has the execution primitives we need:

- headless runner seam via `PromptTurnRunner`
- Codex, Ollama, OpenCode, aider, and Claude runner support
- `spawn` / `await` child sessions
- deterministic `done when` gates
- shell-backed verification
- persistent state
- hybrid-routing experiment plans
- routing manifest schema for runner/model/provider/risk/cost evidence

The current limitation is important: local/frontier routing is not yet a
first-class per-turn PL runtime feature. Today the practical route is an
external harness that invokes separate local and frontier lanes and records the
manifest. Runtime-native provider switching can come later.

## Prior art and what is different

This direction has prior art, but none of the reference systems covers the full
Portarium shape.

| System / paper          | What it proves                                                                                                                | What it does not cover                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| OpenAI Symphony         | A task board can be the control plane for many Codex workspaces.                                                              | Strong governance, approval policy, evidence chain, local/frontier cost routing, or Cockpit as product surface.   |
| Codex App Server        | Codex can be driven through a structured protocol with events, command approvals, file approvals, auth, and rate-limit state. | Cross-agent work planning, Portarium policy, PL gates, or local-model lane economics.                             |
| SWE-agent               | Agent-computer interfaces matter for software engineering agents; tool/interface design changes agent performance.            | Governed team board, human approvals, cost routing, or enterprise evidence.                                       |
| AutoCodeRover           | Structured code search and repair can solve GitHub issues at lower cost than some agent baselines.                            | Operator board, multi-lane orchestration, approvals, or local/frontier model routing.                             |
| Agentless               | Simple localization/repair/validation can beat complex agents on some benchmarks at low cost.                                 | Always-on task scheduling, governed approvals, Cockpit, or multi-worker lifecycle.                                |
| ChatDev / MetaGPT       | Multi-agent software roles and SOPs can coordinate software delivery.                                                         | Strong action-boundary governance, deterministic PL gates, sandbox/workspace policy, or cost-aware local workers. |
| Vibe Kanban-style tools | A kanban UI for coding agents is useful for tracking parallel agent work.                                                     | Portarium-grade policy, approvals, WORM evidence, SoD, and route-cost proof.                                      |

The interesting research claim is therefore not "agents can write code" or
"kanban can track agents." Those are already known. The claim is:

```text
A governed board plus PL contracts can make agentic engineering auditable,
cost-routable, and safer to operate than raw multi-agent coding sessions.
```

That is the gap Portarium can test.

## Team of agents

The team should be subagent-first, not peer-mesh-first. A parent supervisor owns
state, gates, routing, and evidence. Child agents own bounded work.

| Lane                 | Default model class                  | Work                                                                     |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `frontier-pl-author` | Codex / GPT-5-Codex class            | Convert bead intent into PL contract, gates, artifacts, and route policy |
| `frontier-advisor`   | Codex / GPT-5.5 class                | Risk/ambiguity classification and escalation decisions                   |
| `local-bulk`         | gpt-oss / Ollama / other local       | Inventory, boilerplate, docs, fixtures, low-risk code slices             |
| `local-repair`       | gpt-oss / Ollama / other local       | Narrow verifier-named repairs after public gate output                   |
| `frontier-repair`    | Codex / GPT-5-Codex class            | Root-cause analysis after repeated local failure                         |
| `frontier-reviewer`  | Codex / GPT-5.5 class                | Read-only final diff review and architecture/security concerns           |
| `governance-auditor` | deterministic plus frontier optional | Check evidence completeness, SoD, route policy, and approval integrity   |
| `cockpit-operator`   | human                                | Approve plans, approve merges, calibrate policy, and inspect evidence    |

The parent must convert frontier advice into explicit tasks, gates, or stop
conditions before local workers act on it. Free-form advice handed to a local
model is not enough.

## Routing policy v0

Default to local when:

- the task is low risk
- acceptance criteria are explicit
- file ownership is narrow
- verifier output names the failing condition
- the work is repetitive, structural, or documentation-heavy

Escalate to frontier when:

- architecture, auth, security, migration, money, or data-loss risk appears
- local fails the same gate twice
- local times out or produces no edit
- tests and user intent conflict
- the next step requires choosing between multiple defensible designs
- final review touches high-risk code or cross-layer contracts

Never let the worker lane self-certify completion. Parent-owned PL gates and
Portarium evidence decide whether work can advance.

## Cost model

The cost-reduction claim is narrow:

```text
Use frontier models to write, classify, repair, and review the workflow.
Use local models for bulk execution under gates.
```

This does not claim local models can autonomously build the full system. The
expected value is lower frontier-call count per successful bead, while preserving
or improving quality through deterministic gates and final review.

Every run must record:

- runner
- model
- provider class: `local`, `frontier`, `deterministic`, or `human`
- route decision and trigger
- risk and ambiguity level
- input/output artifact refs
- command/gate results
- wall time
- estimated frontier cost
- local GPU minutes when available
- approval IDs and evidence IDs

## R&D milestones

### R0 - Alignment artifact

Done when this note is accepted as the working architecture and linked from the
engineering-layer document map.

### R1 - Manifest-only dry run

Use existing Portarium work items and prompt-language harness manifests to
simulate:

```text
bead -> PL contract -> local route -> gate failure -> frontier repair -> review
```

No live agent execution required. The output is a complete evidence manifest and
Cockpit mock state.

### R2 - Single live local-first bead

Run one low-risk engineering bead with:

- Codex-authored PL contract
- local model bulk lane
- deterministic gate
- frontier final review
- Portarium evidence artifact

Success is not merge. Success is a truthful run record that proves where local
worked, where it failed, and what frontier calls were saved or spent.

### R3 - Governed board integration

Materialize the lifecycle in Portarium:

```text
WorkItem/Bead -> Run -> HumanTask/Approval -> Evidence -> Artifact
```

Cockpit should show lane, model, sandbox, gate status, pending approval, and
artifact links per bead.

### R4 - Codex App Server spike

Prototype a Portarium-owned Codex App Server client:

- start/resume thread
- set cwd/sandbox/approval policy
- observe turn events
- translate command/file approval requests into Portarium approvals
- attach rate-limit/auth status to run evidence

This should remain a spike until the current `codex exec` path and the app-server
path are compared.

### R5 - Policy and budget enforcement

Move from manifest-only budgets to enforced budgets:

- max frontier calls per bead
- max estimated USD per bead
- max local GPU minutes
- escalation cap
- fail-closed when budget telemetry is missing

## First experiment

The first experiment should be deliberately small. It is not trying to prove
that local models can autonomously build Portarium. It is trying to prove the
control loop.

Question:

```text
Can one Portarium bead be executed through a PL contract with local-first work,
frontier escalation/review, deterministic gates, and a complete evidence record?
```

Arms:

| Arm                 | Description                                                                                         | Why                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A - frontier-only   | Codex/frontier model handles the whole bead.                                                        | Quality and cost baseline.                            |
| B - local-only      | Local model handles the bead under the same public gates.                                           | Local capability baseline.                            |
| C - advisor-only    | Frontier writes a plan/review, local model performs edits.                                          | Tests whether advice without route control is enough. |
| D - governed hybrid | Codex authors PL, local handles bulk work, PL gates decide, Codex repairs/reviews only on triggers. | Tests the actual thesis.                              |

Primary metrics:

- deterministic gate pass/fail
- frontier calls per successful bead
- estimated frontier cost per successful bead
- local runtime/GPU minutes
- number of escalations
- final review defects
- evidence completeness
- human approval latency and rationale quality

What this can prove:

- whether the lifecycle can be represented end-to-end in Portarium
- whether local work can replace some frontier calls on a bounded task
- whether PL gates catch local failure without relying on model self-reporting
- whether Cockpit can show the chain clearly enough for a human to decide
- whether the evidence manifest is sufficient for review and repeatability

What this cannot prove:

- that local models are generally autonomous engineers
- that hybrid is cheaper across all work
- that multi-agent work is safe without sandboxing
- that the approach scales to large features
- that humans will not rubber-stamp approvals

The experiment is exciting if D beats B on correctness and uses fewer frontier
calls than A while preserving review quality and evidence completeness. That
would be a real signal that Portarium can turn frontier models into supervisors
and local models into bounded workers.

## First implementation targets

Portarium:

- Add a first-class engineering bead read model instead of only deriving board
  cards from generic work item links.
- Extend `ProjectIntentV1` / `BeadProposalV1` with route policy, dependencies,
  acceptance gates, workspace/sandbox requirements, and evidence requirements.
- Materialize `BeadProposalV1` into `WorkItemV1`, `WorkflowV1`, `RunV1`,
  `ApprovalV1`, and `HumanTaskV1`.
- Add typed bead event contracts instead of relying only on generic normalized
  SSE payloads.
- Add Cockpit fields for lane, model, sandbox, gate status, approval state, and
  evidence completeness.

prompt-language:

- Turn the HA-HR1 harness from dry/fake-live into a live lane runner.
- Keep per-lane manifests authoritative before adding runtime-native routing.
- Add budget enforcement around frontier calls and local worker time.
- Make spawned runner/provider selection explicit enough for local/frontier child
  lanes.
- Investigate Codex App Server as a long-lived runner alternative to `codex exec`.

## Hard boundaries

- Do not claim local-only autonomy until the experiments prove it.
- Do not let local workers see hidden oracles.
- Do not let frontier advice contaminate a local-only measurement batch.
- Do not treat agent instructions as a sandbox.
- Do not approve irreversible actions without Portarium policy and evidence.
- Do not make Cockpit a replacement for Linear, GitHub, or an IDE. Cockpit is the
  governance surface.

## Immediate next move

Build the first demonstrator as a narrow R&D slice:

```text
One Portarium engineering bead
One generated PL contract
One local bulk worker
One deterministic gate
One frontier review
One Portarium evidence artifact
One Cockpit board card showing the whole chain
```

That is the smallest useful proof of the architecture.

## Execution record

2026-05-12:

- Created and claimed Portarium bead `bead-1225`.
- Added this engineering-layer R&D note.
- Linked this note from the engineering-layer document map.
- Added companion prompt-language design note
  `docs/design/governed-symphony-local-routing.md`.
- Added MacquarieCollege reference-vertical note
  `docs/architecture/mc-governed-symphony-reference-vertical.md`.
