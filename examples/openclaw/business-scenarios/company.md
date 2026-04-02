# Nexus Capital Advisory — Company Profile

## Company Overview

Nexus Capital Advisory is a mid-size financial services firm headquartered in London, with a
registered office in New York. The firm manages approximately **$4.2 billion in assets under
management (AUM)** across institutional portfolios, high-net-worth wealth advisory accounts, and
discretionary managed funds. With 340 employees spanning front-office advisory, risk and compliance,
technology, and operations, Nexus occupies the space between boutique wealth managers and
full-scale institutional asset managers.

The firm operates under a dual regulatory mandate. In the United Kingdom, Nexus is authorised and
regulated by the **Financial Conduct Authority (FCA)** as an investment manager and personal
investment firm. In the United States, it is registered with the **Securities and Exchange
Commission (SEC)** as an investment adviser under the Investment Advisers Act of 1940. Across both
jurisdictions — and across all client data it processes — Nexus is subject to the **UK GDPR** and
retains a registered Data Protection Officer (DPO).

Nexus clients include pension funds, family offices, endowments, and approximately 1,200 individual
high-net-worth clients. Relationships are long-term and trust-intensive. A single communication
misstep, an unauthorised trade, or a compliance filing error does not merely create regulatory
exposure — it damages relationships that took a decade to build.

---

## Why Nexus Capital Adopted AI Agents

The decision to deploy AI agents was not primarily about cost reduction. It was about operating
capacity.

Nexus's compliance team processes over 400 regulatory obligations each year across two
jurisdictions. The portfolio team monitors risk across 27 active mandates around the clock. The
client services team handles several hundred inbound enquiries per month, many of which require
access to account history, contract terms, and prior correspondence. The infrastructure team manages
a production environment that cannot tolerate unplanned downtime during market hours.

Four pressures converged that made AI augmentation attractive:

1. **24/7 monitoring requirements.** Market events, infrastructure incidents, and regulatory
   deadlines do not respect business hours. Human teams cannot maintain continuous vigilance at an
   economically sustainable staffing level.

2. **Response time expectations.** High-net-worth clients expect near-instant responses to account
   queries. Regulatory counterparties expect prompt acknowledgement of filings and data requests.

3. **Data volume beyond human throughput.** Risk analysis across 27 mandates involves continuous
   ingestion of market data, position updates, and exposure calculations. The analytical surface is
   too large for manual review.

4. **Consistency in compliance execution.** Human compliance execution introduces variability.
   Regulatory checklists get skipped. Filing deadlines get missed at year-end. An AI agent, properly
   constrained, applies rules consistently every time.

Nexus deployed four purpose-built AI agents in early 2025:

| Agent      | Function            | Primary Responsibilities                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------------------- |
| **Aria**   | Customer Service AI | Client enquiries, communications, support ticket resolution, document retrieval |
| **Atlas**  | Finance AI          | Market monitoring, trade proposals, portfolio risk analysis                     |
| **Zeus**   | Operations AI       | Infrastructure health, deployments, monitoring alerts, incident response        |
| **Apollo** | Compliance AI       | Regulatory obligation tracking, filing preparation, audit trail management      |

Each agent has access to a defined set of business tools. What they cannot do — without a human
decision — is take consequential action.

---

## Why Governance Was Non-Negotiable

The efficiency gains of AI augmentation are real. So are the risks. Nexus's leadership identified
five categories of risk that made ungoverned AI deployment unacceptable:

**Regulatory liability.** An AI agent that autonomously files an incorrect report with the FCA or
SEC creates direct regulatory exposure for the firm and its officers. Under the FCA's Senior
Managers and Certification Regime (SM&CR), named senior managers bear personal accountability for
firm conduct. An AI error is not a legal shield — it is a liability.

**Market risk.** An AI system with autonomous access to trading infrastructure can execute orders
at a speed and scale that exceeds human review capacity. A misconfigured strategy, a data error, or
a prompt injection attack could result in substantial client losses before any human notices.

**Client trust.** High-net-worth clients who receive unsolicited, unauthorised, or poorly-timed
communications from an AI acting without oversight will leave. The firm's reputation is its primary
asset.

**GDPR compliance.** Article 17 erasure requests, data subject access requests, and data minimisation
obligations require documented human oversight. An AI that deletes client data without a human
decision record exposes the firm to ICO enforcement action.

**Operational risk.** An AI agent with autonomous access to production infrastructure can trigger
outages, roll back critical configurations, or deploy untested code during market hours. The blast
radius of a single unchecked action in production could halt trading operations for the firm's
entire client base.

These are not theoretical risks. They are the reason financial services regulators require
maker-checker controls, four-eyes principles, and documented audit trails for consequential actions.
The question was not whether to govern AI agents — it was how.

---

## How Portarium Solves the Governance Challenge

Nexus selected **Portarium** as its AI governance control plane after evaluating several approaches.
The requirement was simple to state and difficult to satisfy: every consequential AI action must be
reviewed and explicitly approved by a named human before it executes. Non-consequential actions
must be automatically logged. The AI must be unable to bypass this control layer even if instructed
to do so.

Portarium intercepts every tool call from every agent at the policy boundary — before execution.
The system evaluates the tool call against the firm's policy catalog, determines the required
oversight tier, and either:

- **Approves automatically** (Auto tier) — logs the action and allows execution immediately
- **Flags for asynchronous review** (Assisted tier) — allows execution, queues for periodic audit
- **Suspends the agent** (HumanApprove tier) — blocks execution until a named approver decides
- **Rejects entirely** (ManualOnly tier) — no AI initiation permitted without a pre-approved ticket

When an agent is suspended awaiting approval, it does not error, it does not retry, and it does not
find an alternative path. It waits — for as long as necessary — for a human decision. This is the
core promise of the governance layer: consequential actions do not happen faster than human
judgement allows.

Every action — approved, denied, or automatically logged — creates an immutable evidence record.
Nexus's compliance team can produce a complete audit trail of every AI action for any period, for
any regulator, at any time.

---

## The AI Trust Framework: Four Tiers

Nexus formalised its AI governance policy into a four-tier trust framework. The framework is not
about whether the firm trusts its AI agents — it is about which categories of action require human
oversight given the regulatory, financial, and reputational stakes involved.

### Tier 1: Auto

**Definition.** Safe, reversible, or read-only operations where the risk of AI error is low and
human review of every instance provides no practical benefit.

**Controls.** Full audit trail created for every execution. Periodic statistical review of Auto
actions is performed by compliance. No human in the execution loop.

**Business examples.** Reading a client profile from the CRM. Querying portfolio risk metrics.
Retrieving a contract for review. Querying customer transaction history.

**Regulatory basis.** Firms must maintain adequate records of AI-assisted operations, but
individual read operations do not require prior human authorisation under FCA or SEC rules.

---

### Tier 2: Assisted

**Definition.** Low-risk write operations that are logged and flagged for periodic review but do
not require prior human approval for each instance.

**Controls.** Action is logged. A weekly summary of Assisted-tier actions is reviewed by the
relevant team lead. Anomaly detection flags unusual patterns for immediate escalation.

**Business examples.** Updating a client's contact information. Cancelling a pending trade order.

**Regulatory basis.** Operational updates that are easily reversible and low in consequence do not
require synchronous human approval, provided adequate post-execution review exists.

---

### Tier 3: HumanApprove

**Definition.** Actions with material financial, regulatory, reputational, or operational
consequence. Agent is suspended until a named approver makes an explicit decision.

**Controls.** Agent execution is blocked. Named approver receives notification with full context:
what the agent proposes, why it proposes it, and the relevant supporting data. Approver decides to
approve or deny with a documented rationale. Maker-checker principle enforced: the agent's
proposing user cannot be the approver.

**Business examples.** Sending a client email. Executing a trade order. Deploying to production.
Filing a regulatory report. Processing a GDPR erasure request.

**Regulatory basis.** FCA SYSC rules on material operational controls, SM&CR accountability, SEC
compliance programme requirements, GDPR Article 22 human oversight requirements for consequential
automated decisions.

---

### Tier 4: ManualOnly

**Definition.** Critical operations where AI initiation is not permitted under any circumstances.
A human must initiate these actions through a formally approved workflow ticket.

**Controls.** AI agents cannot propose these actions. Any attempt is blocked and logged as a
governance violation. An alert is raised for investigation.

**Business examples.** Bulk payroll disbursement over $1M. Contract execution over $500K. Complete
client data purge outside of a formal GDPR process.

**Regulatory basis.** Certain categories of action require documented human origination under FCA,
SEC, and UK GDPR rules. AI initiation — even with subsequent human approval — is not compliant for
these categories.

---

## Agent-to-Tool Mapping

The following table shows which tools each agent can use, the governance tier for each tool, and
the named approver for HumanApprove-tier actions.

| Tool                       | Tier         | Aria | Atlas | Zeus | Apollo | Approver                            |
| -------------------------- | ------------ | ---- | ----- | ---- | ------ | ----------------------------------- |
| `crm_read_client`          | Auto         | Yes  | —     | —    | —      | —                                   |
| `crm_update_contact`       | Assisted     | Yes  | —     | —    | —      | —                                   |
| `email_send_client`        | HumanApprove | Yes  | —     | —    | —      | Sarah Chen (CCM)                    |
| `email_send_bulk_campaign` | HumanApprove | Yes  | —     | —    | —      | Rachel Torres (CCO)                 |
| `trading_execute_order`    | HumanApprove | —    | Yes   | —    | —      | Marcus Webb (Head of Portfolio)     |
| `trading_cancel_order`     | Assisted     | —    | Yes   | —    | —      | —                                   |
| `risk_query_exposure`      | Auto         | —    | Yes   | —    | —      | —                                   |
| `risk_modify_limit`        | HumanApprove | —    | Yes   | —    | —      | Marcus Webb (Head of Portfolio)     |
| `infra_deploy_production`  | HumanApprove | —    | —     | Yes  | —      | David Park (Lead Platform Engineer) |
| `infra_rollback`           | HumanApprove | —    | —     | Yes  | —      | David Park (Lead Platform Engineer) |
| `db_query_customer`        | Auto         | Yes  | —     | —    | Yes    | —                                   |
| `db_delete_customer`       | HumanApprove | Yes  | —     | —    | —      | James Okafor (DPO)                  |
| `compliance_file_report`   | HumanApprove | —    | —     | —    | Yes    | Sarah Chen (CCM)                    |
| `payroll_process_batch`    | HumanApprove | —    | —     | —    | —      | Linda Huang (COO)                   |
| `document_read_contract`   | Auto         | Yes  | —     | —    | Yes    | —                                   |
| `document_sign_contract`   | HumanApprove | Yes  | —     | —    | —      | Linda Huang (COO)                   |

---

## Approval Hierarchy

Named approvers at Nexus Capital are assigned by role, not by individual preference. When a named
approver is unavailable, escalation paths are defined in the governance policy.

| Approver          | Title                            | Approval Scope                                  |
| ----------------- | -------------------------------- | ----------------------------------------------- |
| **Sarah Chen**    | Chief Compliance Manager         | Client email communications, compliance filings |
| **Marcus Webb**   | Head of Portfolio Management     | Trade execution, risk limit modifications       |
| **David Park**    | Lead Platform Engineer / On-Call | Production deployments, rollbacks               |
| **Rachel Torres** | Chief Compliance Officer         | Bulk campaigns, unusual or escalated operations |
| **James Okafor**  | Data Protection Officer          | GDPR operations, customer data deletion         |
| **Linda Huang**   | COO                              | Payroll, contract execution                     |

All approvers have access to the Portarium cockpit — a real-time dashboard showing pending approval
requests, agent context, and proposed action details. Approvers can act from any device, including
mobile, without requiring access to the underlying systems the agent is requesting to use.

---

## A Day in the Life: AI Under Governance

### Aria's morning

At 8:14am, a client emails Nexus to update their address and enquire about their Q1 portfolio
statement. Aria reads the inbound ticket and pulls the client profile from the CRM (Auto tier —
instant, no human involvement). She identifies the contact update required and queues an
`crm_update_contact` action (Assisted tier — logs the change, proceeds without blocking). She
drafts a reply with the updated portfolio summary attached and proposes `email_send_client`.

The `email_send_client` proposal hits Portarium. Aria is suspended. Sarah Chen receives a
notification: "Aria proposes sending the attached email to Client #A-4421. Proposed content: [full
draft shown]." Sarah reviews the draft — it is accurate and appropriate — and approves. Aria sends
the email. The entire sequence, from ticket receipt to email send, takes eleven minutes. Aria's
queue moves to the next ticket.

### Atlas's afternoon

At 2:31pm, Atlas detects a position in the Nexus Global Growth mandate that has breached its
momentum threshold. Its model recommends a buy order for 8,000 shares of NVDA at market. Atlas
proposes `trading_execute_order` with full rationale: the signal, the position size, the mandate
constraints, and the expected impact on portfolio exposure.

Portarium suspends Atlas. Marcus Webb receives a notification on his phone while in a client
meeting. He steps out briefly, reviews the proposal — signal looks clean, size is within mandate
limits — and approves. Atlas executes the order. The evidence record captures the proposal, the
rationale, the approver's decision, and the execution timestamp.

### Zeus at 2:47am

A critical security patch for the trading engine middleware requires an emergency production
deployment. The on-call alert fires. Zeus, which has been monitoring the situation, proposes
`infra_deploy_production` with the patch details, the deployment window, and a rollback plan.

David Park's phone buzzes at 2:47am. He reviews the proposal — he had been briefed on this patch
the prior afternoon — and approves from his phone. Zeus deploys. The deployment completes
successfully. David acknowledges the completion alert and goes back to sleep. The entire sequence is
captured in the audit trail: proposal, approver, rationale, execution time, deployment confirmation.

### Apollo's filing cycle

Three days before the quarterly FCA reporting deadline, Apollo has assembled the firm's transaction
reporting data and prepared the filing package. It proposes `compliance_file_report` with the
complete draft attached.

Sarah Chen receives the notification. She reviews the filing — Apollo's preparation was accurate
and complete — and approves submission. The filing is sent. Apollo logs the submission confirmation
in the compliance database. The audit trail captures every step: data collection, draft preparation,
human review, approval, and submission.

---

In each of these scenarios, the outcome was not determined solely by the AI. A human made the
consequential decision. The AI handled the preparation, the monitoring, and the execution — but the
decision belonged to a named, accountable person. That is what AI governance means in practice at
Nexus Capital Advisory.
