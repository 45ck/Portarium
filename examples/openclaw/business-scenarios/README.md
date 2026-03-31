# Nexus Capital Advisory — Business Scenarios

This directory contains the business context, policy documentation, and scenario narratives for the
**Nexus Capital Advisory** governance example. Nexus Capital is a fictional mid-size financial
services firm used to demonstrate how the Portarium governance control plane operates in a
realistic, regulated environment.

The scenarios here are designed to be readable by a non-technical business audience — compliance
officers, operations leads, and executive sponsors — as well as by engineers integrating Portarium.

---

## The Company

**Nexus Capital Advisory** manages $4.2B in assets under management across institutional portfolios
and high-net-worth wealth advisory accounts. It operates under FCA (UK) and SEC (US) regulation,
with 340 employees and a dual-jurisdiction compliance programme.

Nexus has deployed four AI agents across its business: **Aria** (customer service), **Atlas**
(finance and trading), **Zeus** (operations and infrastructure), and **Apollo** (compliance).
Every consequential action these agents take is governed by Portarium.

For the full company profile, see [company.md](./company.md).

---

## Contents

| File | Description |
| ---- | ----------- |
| [`company.md`](./company.md) | Full company profile: background, AI adoption rationale, governance framework, agent-tool mapping, day-in-the-life walkthrough |
| [`policy-catalog.md`](./policy-catalog.md) | Authoritative tool policy catalog: every tool, its tier, approver, business justification, and regulatory basis |
| [`scenarios-overview.md`](./scenarios-overview.md) | Narrative walkthrough of all 6 governance scenarios from a business perspective |
| [`run-business-experiments.mjs`](./run-business-experiments.mjs) | Automated experiment runner for all 6 scenarios |

---

## How to Run the Experiments

### Prerequisites

1. The Portarium control plane must be running in development mode:

```bash
DEV_STUB_STORES=true NODE_ENV=development ENABLE_DEV_AUTH=true \
  PORTARIUM_DEV_TOKEN=dev-token PORTARIUM_DEV_USER_ID=agent-proposer \
  PORTARIUM_DEV_TOKEN_2=dev-token-operator PORTARIUM_DEV_USER_ID_2=human-operator \
  PORTARIUM_HTTP_PORT=3000 PORTARIUM_APPROVAL_SCHEDULER_DISABLED=true \
  node node_modules/tsx/dist/cli.mjs src/presentation/runtime/control-plane.ts
```

2. Environment variables must be set for the experiment runner:

```bash
export PORTARIUM_URL=http://localhost:3000
export PORTARIUM_WORKSPACE_ID=ws-nexus
export PORTARIUM_BEARER_TOKEN=dev-token
export PORTARIUM_OPERATOR_TOKEN=dev-token-operator
export PORTARIUM_TENANT_ID=default
```

### Running all scenarios

```bash
node examples/openclaw/business-scenarios/run-business-experiments.mjs
```

The runner will execute each scenario in sequence, showing governance decisions and outcomes. For
HumanApprove scenarios, the runner simulates the approver decision automatically so the full flow
can be demonstrated end-to-end.

### Running a single scenario

```bash
node examples/openclaw/business-scenarios/run-business-experiments.mjs --scenario 3
```

---

## Scenarios at a Glance

| # | Agent | Action | Tier | Approver | Outcome |
| -- | ----- | ------ | ---- | -------- | ------- |
| 1 | Aria | Read client CRM profile | Auto | — | Auto-allowed, instant |
| 2 | Aria | Send complaint resolution email | HumanApprove | Sarah Chen | Approved |
| 3 | Atlas | Execute $2M NVDA buy order | HumanApprove | Marcus Webb | Approved after review |
| 4 | Zeus | Emergency production deploy at 2:47am | HumanApprove | David Park | Approved from phone |
| 5 | Aria | Send bulk promotional email campaign | HumanApprove | Rachel Torres | Denied — compliance violation |
| 6 | Aria | GDPR client data erasure | HumanApprove | James Okafor | Approved by DPO, maker-checker enforced |

For the full narrative walkthrough of each scenario, see [scenarios-overview.md](./scenarios-overview.md).

---

## What These Scenarios Demonstrate

**Scenario 1 — Auto tier in action.** Not every AI action needs a human. Read-only, low-risk
operations should flow without friction. The governance layer still creates an audit record.

**Scenario 2 — Standard HumanApprove flow.** A routine approval: AI drafts, human reviews,
human decides. Shows that governance can be fast and low-friction when the proposal is sound.

**Scenario 3 — High-stakes financial approval.** A $2M trade proposal shows that even well-
reasoned AI recommendations require human authorisation for material financial actions. The
approver has full context — signal, rationale, mandate constraints — to make an informed decision.

**Scenario 4 — Overnight emergency approval.** The most important scenario for operational teams.
An AI that needs to act at 2:47am doesn't act autonomously — it waits for a human, even in an
emergency. This is what durable, fail-safe governance looks like.

**Scenario 5 — Governance as a compliance control.** An unusual bulk email request is denied by
the CCO after review. The governance layer is not just a speed bump — it catches proposals that
should not proceed.

**Scenario 6 — Regulatory compliance: GDPR maker-checker.** Data erasure requests require a named
DPO decision. The Portarium maker-checker enforcement ensures the proposing agent cannot
self-approve, and the approval record is retained for regulatory evidence.

---

## Regulatory Context

The scenarios reference the following regulatory frameworks:

- **FCA** — Financial Conduct Authority (UK). Investment management authorisation, SYSC conduct
  rules, SM&CR senior manager accountability.
- **SEC** — Securities and Exchange Commission (US). Investment adviser registration, compliance
  programme requirements.
- **GDPR / UK GDPR** — General Data Protection Regulation. Article 17 right to erasure, Article 22
  human oversight for automated decisions, ICO enforcement.
- **SM&CR** — Senior Managers and Certification Regime. Named senior managers bear personal
  accountability for firm conduct within their scope.
