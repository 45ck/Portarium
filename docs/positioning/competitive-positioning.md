# Competitive Positioning — Portarium

## Where Portarium sits

Portarium is the **safety and approval layer between AI agents and real-world business systems**.

It is not an agent runtime, not a workflow builder, not an integration platform, and not a system of record. It is the governance membrane that sits above all of those.

Agents propose. Portarium decides what is allowed, what needs approval, and what gets blocked. Then it keeps the paper trail.

---

## Portarium vs ServiceNow AI Control Tower

**ServiceNow** is a management and oversight center for enterprise AI assets and workflows.

**Portarium** is enforcement in the path of execution.

| | ServiceNow AI Control Tower | Portarium |
|---|---|---|
| **Core job** | See and govern your AI estate | Enforce rules before AI actions execute |
| **Position in stack** | Dashboard and command center above AI operations | Inline enforcement layer in the execution path |
| **Governance model** | Observe, monitor, manage | Evaluate policy, approve/deny/block, record evidence |
| **Scope** | Enterprise AI portfolio management | Per-action governance for any agent |
| **Deployment** | Part of ServiceNow platform | Open-source, standalone, works with any agent |

**The difference**: ServiceNow says "see and govern your AI estate." Portarium says "no agent action reaches the target system unless it passes through rules, approval, and evidence capture first."

ServiceNow is the command center. Portarium is the checkpoint.

---

## Portarium vs UiPath

**UiPath** orchestrates robots, agents, and people across business processes.

**Portarium** governs what each agent action is allowed to do before it executes.

| | UiPath | Portarium |
|---|---|---|
| **Core job** | Orchestrate work across humans, bots, and systems | Govern what AI actions are allowed to execute |
| **Position in stack** | Process orchestration platform | Action governance and execution mediation |
| **Focus** | How do we automate work? | How do we make every AI action governable? |
| **Strength** | Broad automation across enterprise processes | Deep per-action safety, approval, and evidence |
| **Governance** | Process-level controls | Action-level policy, approval, and audit |

**The difference**: UiPath asks "how do we automate work across humans and systems?" Portarium asks "how do we make sure every AI action is safe, approved, and traceable before it executes?"

UiPath is process orchestration. Portarium is action governance.

---

## Portarium vs Workato

**Workato** is integration-first. Connect systems, automate flows.

**Portarium** is policy-first. Make sure agent actions are bounded, reviewable, and enforceable.

| | Workato | Portarium |
|---|---|---|
| **Core job** | Connect systems and automate workflows | Enforce safety, approval, and evidence for AI actions |
| **Center of gravity** | Integration and automation fabric | Safety, policy, and approval fabric |
| **Governance** | Workflow-level controls and permissions | Per-action policy evaluation, human approval gates, evidence capture |
| **Agent support** | Agent-assisted automation within flows | Sits above any agent; governs actions regardless of source |

**The difference**: Workato connects systems and automates flows. Portarium makes sure AI actions are bounded, reviewable, attributable, and enforceable before those integrations do anything.

Workato is the automation fabric. Portarium is the safety fabric.

---

## Portarium vs LangGraph / CrewAI / AutoGen

**LangGraph** (and similar frameworks) help you build agent runtimes and flows.

**Portarium** is what sits above those runtimes when you need real governance.

| | LangGraph / CrewAI / AutoGen | Portarium |
|---|---|---|
| **Core job** | Build and run agent workflows | Govern what agent actions are allowed to do |
| **Position in stack** | Agent runtime / orchestration | Governance layer above agent runtimes |
| **Focus** | Agent planning, branching, tool calling | Policy, approval, evidence, execution mediation |
| **Relationship** | The engine that makes agents think | The layer that decides what agents can actually do |

**The difference**: LangGraph helps agents think and branch. Portarium decides what can actually happen. They are complementary, not competing.

Your agent framework is the engine. Portarium is the safety system.

---

## Portarium vs GitHub AI Controls (Copilot)

**GitHub's AI controls** govern agent behavior inside the GitHub product boundary.

**Portarium** governs actions across any connected system.

| | GitHub AI Controls | Portarium |
|---|---|---|
| **Core job** | Govern Copilot and AI within GitHub | Govern AI actions across arbitrary business systems |
| **Scope** | One product boundary (GitHub) | Cross-system: GitHub, Slack, Odoo, Google Workspace, infrastructure, etc. |
| **Governance model** | Product-scoped policies and guardrails | Universal policy evaluation, approval workflows, evidence capture |
| **Deployment** | Built into GitHub | Standalone, connects to anything via adapters |

**The difference**: GitHub governs AI inside one product. Portarium governs AI across the entire operational surface.

GitHub is product-scoped AI governance. Portarium is cross-system operational governance.

---

## Portarium vs HumanLayer (Agent Control Protocol)

**HumanLayer** is the closest open-source neighbour. It provides a human-in-the-loop control pattern for agent runtimes.

**Portarium** is broader and more opinionated.

| | HumanLayer ACP | Portarium |
|---|---|---|
| **Core job** | Human feedback and approval for agent actions | Full governance: policy, approval, evidence, execution, audit |
| **Scope** | Agent runtime support / control pattern | Enterprise operational control plane |
| **Governance depth** | Human interrupts and approval signals | Execution tiers, policy evaluation, evidence-first audit, workspace-scoped operations |
| **Integration model** | SDK / protocol for agent runtimes | Ports-and-adapters above systems of record |

**The difference**: HumanLayer adds human feedback to agent runtimes. Portarium is a complete governance layer: policy evaluation + approval workflows + evidence capture + execution mediation + audit trail.

HumanLayer is the closest OSS analogue. Portarium's thesis is more "enterprise operational safety layer" than "agent runtime with human feedback."

---

## Summary positioning

| Product | What it is | Portarium's relationship |
|---|---|---|
| ServiceNow AI Control Tower | AI estate management | Portarium is enforcement in the execution path, not just oversight |
| UiPath | Process orchestration | Portarium governs the actions within processes |
| Workato | Integration and automation | Portarium adds safety and approval before automations execute |
| LangGraph / CrewAI / AutoGen | Agent runtimes | Portarium sits above runtimes as the governance layer |
| GitHub AI Controls | Product-scoped AI governance | Portarium is cross-system governance |
| HumanLayer ACP | Human-in-the-loop for agents | Portarium is broader: policy + approval + evidence + execution |

**One sentence**: ServiceNow manages AI operations, UiPath orchestrates processes, Workato connects systems, LangGraph builds agent flows, and GitHub governs AI inside GitHub. Portarium is the universal safety and approval layer that governs what any AI agent is allowed to do across real business systems before execution happens.

---

## The mental model

Portarium is to agent actions what an API gateway + policy engine + approval system + audit log would be if they were fused into one agent-native safety layer.

Simpler: **Portarium is a traffic controller for AI actions.**

Agents submit what they want to do. Portarium evaluates the rules, routes approval when needed, executes through connectors if permitted, and records everything for later review.
