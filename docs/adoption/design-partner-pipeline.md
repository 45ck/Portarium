# Design-Partner Pipeline

A design partner is an early adopter who commits to deploying Portarium in a
real environment in exchange for direct access to the core team, influence
over the roadmap, and priority support during onboarding.

This document defines the pipeline stages, qualification criteria, and
operational playbook for managing design-partner relationships.

## Pipeline Stages

### 1. Identification

**Goal:** Build a shortlist of candidate organisations.

**Sources:**

- GitHub stars/forks with non-trivial activity (issue comments, PRs).
- Inbound enquiries via docs site contact form or Discord.
- Conference/meetup attendees who attended a Portarium talk or demo.
- Referrals from existing community members.

**Qualification criteria (must meet at least 3 of 5):**

1. Runs a multi-service production system with approval workflows today.
2. Has a compliance or governance requirement (SOC 2, ISO 27001, FedRAMP).
3. Engineering team of 5+ with capacity to dedicate 1 engineer part-time.
4. Willing to share anonymised usage data and feedback.
5. Use case aligns with a Portarium vertical pack (finance, HR, security ops, robotics).

### 2. Outreach

**Goal:** Make first contact and gauge interest.

**Template email/message:**

> Subject: Portarium design-partner programme — early access + roadmap influence
>
> Hi [Name],
>
> We noticed [signal — e.g., "your contributions to issue #123"].
> We're looking for design partners to shape Portarium's next phase
> and wanted to see if your team would be interested.
>
> Design partners get:
>
> - Direct Slack/Discord channel with the core team
> - Priority bug fixes and feature requests
> - Co-development sessions for vertical pack integration
> - Logo placement on the project site (with permission)
>
> In return, we ask for:
>
> - A real deployment (staging or production) within 8 weeks
> - Bi-weekly feedback sessions (30 min)
> - Permission to reference the partnership publicly (anonymised if preferred)
>
> Would a 20-minute intro call work this week?

**Follow-up cadence:** Day 0 (initial), Day 3 (bump), Day 10 (final).

### 3. Qualification Call

**Goal:** Confirm fit and set expectations.

**Agenda (20 min):**

1. Their current workflow/approval system and pain points (5 min).
2. Portarium overview and how it addresses their needs (5 min).
3. Design-partner terms and timeline (5 min).
4. Q&A and next steps (5 min).

**Disqualification signals:**

- No concrete use case ("just exploring").
- Cannot allocate engineering time within 4 weeks.
- Requires features that conflict with Portarium's architecture (e.g., closed-source fork).

### 4. Onboarding

**Goal:** Get the partner to a running Portarium instance with their first workflow.

**Checklist:**

- [ ] Shared Slack/Discord channel created.
- [ ] Partner completes [L0 — Discovery](./adoption-ladder.md#l0--discovery) (Hello Portarium quickstart).
- [ ] Partner completes [L1 — Integration Spike](./adoption-ladder.md#l1--integration-spike) with their use case.
- [ ] First bi-weekly sync scheduled.
- [ ] Feedback tracker (GitHub project board or shared doc) created.

**Timeline target:** L1 complete within 4 weeks of onboarding start.

### 5. Active Partnership

**Goal:** Partner is running Portarium in staging/production and providing regular feedback.

**Cadence:**

- Bi-weekly sync (30 min): blockers, feature requests, roadmap preview.
- Monthly retrospective (15 min): what's working, what's not.
- Quarterly review: assess continuation, upgrade to production reference, or wind down.

**Success metrics:**

- Workflow runs per week (target: >10 in staging, >50 in production).
- Mean time from feedback to fix/feature (target: <2 weeks for P1, <6 weeks for P2).
- Partner NPS score (target: >8/10).

### 6. Graduation

**Goal:** Partner transitions from design partner to self-sufficient adopter.

**Criteria:**

- Running in production for >3 months.
- No P1 blockers for >4 weeks.
- Completed [L3 — Production](./adoption-ladder.md) or equivalent.

**Post-graduation:**

- Logo added to project site (with permission).
- Case study written (with partner review).
- Partner joins community advisory group (optional).

## Tracking

Use a GitHub project board with columns matching pipeline stages. Each
partner is a card with:

- Organisation name
- Primary contact
- Current stage
- Next action + due date
- Notes from last sync

## Capacity

Target 3-5 active design partners at any time. More than 5 dilutes the
quality of support; fewer than 3 risks insufficient feedback diversity.
