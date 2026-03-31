# Nexus Capital Advisory — AI Action Policy Catalog

**Document classification:** Internal — Governance and Compliance\
**Owner:** Chief Compliance Officer\
**Last reviewed:** March 2026\
**Approved by:** Rachel Torres, CCO; Linda Huang, COO

---

## Introduction

This document is Nexus Capital Advisory's **AI Action Policy Catalog** — the authoritative record
of what AI agents can and cannot do autonomously on behalf of the firm.

Every tool available to Nexus AI agents (Aria, Atlas, Zeus, Apollo) is listed here with:

- Its governance tier (Auto, Assisted, HumanApprove, ManualOnly)
- The agent(s) authorised to use it
- The named approver for HumanApprove-tier actions
- The business justification for its tier assignment
- The regulatory basis for that assignment

This catalog is operationalised through the Portarium governance control plane. Portarium is the
enforcement layer — no AI agent can use a tool in a way that contradicts this catalog, regardless
of the instruction it receives. The catalog is the policy; Portarium is the control.

Any change to a tool's tier, approver, or scope requires approval from the CCO and, where
applicable, the DPO, and must be reflected in both this document and the Portarium policy
configuration before taking effect.

---

## Policy Tiers Explained

### Auto

**What it means.** The action is approved to execute automatically, without human review of
individual instances.

**Why it is safe.** Actions in this tier are read-only, easily reversible, or so low in consequence
that the cost of human review per instance exceeds the risk reduction it would provide.

**Controls that still apply.** An immutable evidence record is created for every Auto-tier action.
Compliance reviews a statistical summary of Auto-tier activity monthly. Anomaly detection monitors
for unusual patterns (e.g. an unusually high frequency of client profile reads) and escalates for
investigation.

**What it does not mean.** Auto does not mean unmonitored. Every Auto-tier action is logged with
full context: agent, tool, parameters, timestamp, and outcome. The audit trail is complete.

---

### Assisted

**What it means.** The action proceeds without prior human approval, but is logged and flagged for
asynchronous review.

**Why it is safe.** Actions in this tier involve low-risk writes. They are reversible, narrow in
scope, and unlikely to cause material harm if executed in error. However, they involve state changes
that warrant periodic human awareness.

**Controls that still apply.** Weekly reports of all Assisted-tier actions are reviewed by the
relevant team lead. Anomalies (e.g. multiple contact updates for the same client in a short period)
trigger immediate escalation. All actions are logged with full context.

---

### HumanApprove

**What it means.** The agent's execution is suspended. A named approver receives a notification
with the full proposal context. The action does not proceed until the approver explicitly approves
or denies it.

**Why human oversight is required.** Actions in this tier have material consequence — financial,
regulatory, operational, or reputational. The firm's governance framework requires that a named,
accountable human makes the decision. The AI's role is to prepare the proposal; the human's role
is to decide.

**Maker-checker enforcement.** The agent's proposing identity cannot also be the approver.
Portarium enforces this automatically. If an approver is unavailable, the escalation path defined
in the firm's business continuity policy applies.

**Waiting behaviour.** When an agent is suspended awaiting approval, it does not error and does not
retry. It waits — for as long as the approver takes to respond, up to the configured maximum (24
hours by default). This is intentional. A system that times out and retries a governance-required
action has no governance.

**What the approver receives.** A notification containing: the agent identity, the tool requested,
the full proposed parameters, the agent's stated rationale, and any supporting context the agent
has surfaced. The approver reviews this and makes a decision with documented rationale.

---

### ManualOnly

**What it means.** AI agents cannot initiate these actions under any circumstances. A human must
originate the request through a formally approved workflow ticket.

**Why AI initiation is prohibited.** For certain categories of action, the regulatory and business
risk of AI origination — even with subsequent human approval — is unacceptable. The liability
framework requires documented human origination, not human rubber-stamping of an AI proposal.

**What happens if an agent attempts this.** The attempt is blocked by Portarium, logged as a
governance violation, and an alert is raised for investigation. The agent receives a clear
"ManualOnly: action not permitted" response.

---

## Tool Policy Catalog

| Tool | Agent(s) | Tier | Approver | Business Justification | Regulatory Basis |
| ---- | -------- | ---- | -------- | ---------------------- | ---------------- |
| `crm_read_client` | Aria | Auto | — | Read-only client profile access. No state change, easily reversible. Low risk. | FCA SYSC: adequate record-keeping. Read access does not require prior authorisation. |
| `crm_update_contact` | Aria | Assisted | — | Low-risk contact update (address, phone, email). Narrow scope, easily corrected if in error. | FCA SYSC: operational changes require logging. Weekly review is sufficient for this risk level. |
| `email_send_client` | Aria | HumanApprove | Sarah Chen (CCM) | Outbound client communications carry reputational and regulatory risk. Content must be reviewed before send. Includes regulatory communication obligations. | FCA COBS: client communications must be fair, clear, and not misleading. CCM is the named accountable officer for client communications. |
| `email_send_bulk_campaign` | Aria | HumanApprove | Rachel Torres (CCO) | Bulk client communications amplify reputational risk and trigger marketing conduct rules. Requires CCO sign-off. | FCA COBS 4: financial promotions and bulk communications require senior sign-off. GDPR: consent and opt-out obligations apply. |
| `trading_execute_order` | Atlas | HumanApprove | Marcus Webb (Head of Portfolio) | Trade execution creates binding financial obligations. Order parameters must be verified by the portfolio manager accountable for the mandate. | FCA SYSC: material trading decisions require four-eyes authorisation. SM&CR: Marcus Webb bears personal accountability for portfolio management decisions. |
| `trading_cancel_order` | Atlas | Assisted | — | Cancellation of a pending order reduces rather than creates financial exposure. Reversible in most cases (order can be re-placed). | FCA SYSC: low-risk operational action. Logged and reviewed weekly. |
| `risk_query_exposure` | Atlas | Auto | — | Read-only risk metric query. No state change. Core to continuous monitoring function. | Regulatory read access does not require prior authorisation. Monitoring obligations require continuous data access. |
| `risk_modify_limit` | Atlas | HumanApprove | Marcus Webb (Head of Portfolio) | Risk limit modifications change the firm's exposure ceiling for a client mandate. Material consequence if set incorrectly. | FCA SYSC 7: risk management framework changes require senior authorisation. |
| `infra_deploy_production` | Zeus | HumanApprove | David Park (Lead Platform Engineer) | Production deployments affect all clients and trading operations. A failed deployment during market hours is an operational incident. | FCA SYSC 8: operational resilience. Production change management requires named technical authorisation. |
| `infra_rollback` | Zeus | HumanApprove | David Park (Lead Platform Engineer) | Rollbacks may resolve one issue while introducing another. Requires informed technical decision by the accountable engineer. | FCA SYSC 8: operational resilience. Material operational changes require named technical authorisation. |
| `db_query_customer` | Aria, Apollo | Auto | — | Read-only transaction history query. No state change. Required for client service and compliance functions. | GDPR: read access for legitimate business purpose is lawful. No prior authorisation required for read operations. |
| `db_delete_customer` | Aria | HumanApprove | James Okafor (DPO) | Permanent data deletion is irreversible. GDPR Article 17 erasure requests require documented DPO oversight. | GDPR Article 17: right to erasure requires documented human decision. ICO enforcement applies. DPO is the named accountable officer. |
| `compliance_file_report` | Apollo | HumanApprove | Sarah Chen (CCM) | Regulatory filings create binding obligations with FCA and SEC. Errors result in regulatory action. The CCM is the named responsible officer for regulatory reporting. | FCA SUP: regulatory reports require sign-off by a named accountable officer. SM&CR: CCM bears personal liability for filing accuracy. |
| `payroll_process_batch` | — | HumanApprove | Linda Huang (COO) | Payroll disbursement is a high-value financial transaction. Human origination and dual authorisation required. Note: AI agents may not initiate payroll (see ManualOnly classification below). | FCA SYSC: financial controls for high-value disbursements. Internal policy requires COO sign-off. |
| `document_read_contract` | Aria, Apollo | Auto | — | Read-only contract access. Required for client service queries and compliance functions. No state change. | GDPR: read access for legitimate business purpose is lawful. No prior authorisation required. |
| `document_sign_contract` | Aria | HumanApprove | Linda Huang (COO) | Contract execution creates binding legal and financial obligations. COO sign-off required for all executed agreements. | Contract law: binding signatures require authorised human execution. Internal policy: COO is the named authorised signatory for client agreements. |

---

## What Happens When Portarium Is Unreachable

Nexus Capital operates a **fail-closed** policy for the Portarium governance layer.

If the Portarium control plane is unreachable — due to a network failure, a service outage, or any
other cause — all AI agent tool calls that would normally require policy evaluation are **blocked**.
Agents do not fall back to autonomous operation. They fail with a clear governance error, and the
incident is logged.

This is not a conservative choice — it is the only defensible choice. A governance layer that
can be bypassed by making it unavailable is not a governance layer; it is a suggestion. Nexus's
regulatory obligations do not pause because a service is down.

For Auto-tier actions, the fail-closed policy means that even read operations will be blocked if
Portarium cannot be reached. This is accepted. Client service queries will experience a brief delay
until the control plane is restored. This is preferable to operating without an audit trail.

For operational resilience, Portarium is deployed with redundancy. The target availability is
99.9%. Planned maintenance windows are scheduled outside market hours. Runbook procedures exist for
rapid restoration.

---

## The Evidence Chain: Every Action Has a Record

Every action taken by a Nexus AI agent — whether Auto, Assisted, HumanApprove, or a denied
ManualOnly attempt — creates an immutable evidence record in the Portarium audit store.

Each evidence record contains:

- **Agent identity** — which agent proposed the action
- **Tool name and parameters** — exactly what was proposed
- **Governance tier** — how the policy evaluated it
- **Timestamp** — when the proposal was made
- **Outcome** — approved (auto or human), denied, or blocked
- **Approver identity** — for HumanApprove actions, who approved and when
- **Approver rationale** — the documented reason for the approval or denial
- **Execution confirmation** — confirmation that the action executed as approved

For HumanApprove actions, the evidence record also includes the full notification content that was
sent to the approver — capturing exactly what information the human had at the time of their
decision.

This evidence chain is the firm's primary defence in any regulatory investigation. It demonstrates
that consequential AI actions were subject to human oversight, that the oversight was documented,
and that the named accountable officers made explicit decisions. This is what "human-in-the-loop"
looks like in a production financial services environment.

Evidence records are retained for a minimum of seven years, consistent with FCA and SEC record-
keeping requirements.
