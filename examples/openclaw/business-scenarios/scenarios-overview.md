# Nexus Capital Advisory — Governance Scenarios: Business Narrative

This document walks through each of the six governance scenarios from a business perspective.
These are not abstract demonstrations of a technology protocol. They are the kinds of situations
that happen in a regulated financial services firm every working day — and occasionally in the
middle of the night.

The purpose of reading these scenarios is to understand what AI governance looks like in practice:
what it enables, what it prevents, and what it means for the humans who remain accountable.

---

### Scenario 1: CRM Profile Read

**Agent:** Aria (Customer Service AI)\
**Action requested:** Read client profile for Account #A-4421 from the CRM\
**Governance tier:** Auto\
**Approver:** None required

**Why it matters (and why it doesn't require a human).**
Every client interaction Aria handles begins with reading a client profile. Contact details, account
summary, relationship notes, communication preferences. This is read-only. If Aria reads the wrong
profile by mistake, no harm has been done — no data has changed, no communication has been sent.
The error is detectable and correctable.

**What happened.**
At 8:14am, a client submitted a support ticket querying their Q1 portfolio statement. Aria received
the ticket and called `crm_read_client` with the client account ID. The Portarium governance layer
evaluated the request: `crm_read_client` is classified as Auto tier. Portarium logged the action —
agent identity, tool, parameters, timestamp — and allowed it to proceed immediately. The entire
evaluation and execution took under 50 milliseconds. Aria had the client profile and began
composing her response.

**Outcome:** Auto-allowed. No human involvement required. Full audit record created.

**Business insight.**
Not every AI action should require human approval. A governance framework that puts every read
operation behind a human reviewer creates friction without reducing risk. The value of the
governance layer is not that it slows everything down — it is that it correctly identifies which
actions require human judgement and applies oversight precisely there. Auto tier is the governance
layer acknowledging that some actions are genuinely low-risk. The audit trail still exists. Nothing
is invisible.

**Compliance note:**
GDPR lawful basis for processing applies. Read access for legitimate business purposes does not
require additional authorisation. The audit trail satisfies FCA SYSC record-keeping requirements.

---

### Scenario 2: Client Complaint Resolution Email

**Agent:** Aria (Customer Service AI)\
**Action requested:** Send a complaint resolution email to a client who reported a delayed statement\
**Governance tier:** HumanApprove\
**Approver:** Sarah Chen (Chief Compliance Manager)

**Why it's consequential.**
Client communications from a regulated financial services firm are not just business correspondence.
Under FCA COBS rules, client communications must be fair, clear, and not misleading. A communication
that contains an inaccurate statement about account performance, a poorly-worded explanation of a
delay, or a commitment the firm cannot honour creates regulatory and reputational exposure. The
client receiving an AI-drafted email they did not ask for — and that contains an error — will not
distinguish between "the AI made a mistake" and "Nexus made a mistake." To them, it is the same.

**What happened.**
Aria drafted the complaint resolution email: acknowledging the delay, explaining the cause, and
confirming the statement had now been sent. The email was accurate and professionally worded. Aria
proposed `email_send_client` with the full draft as a parameter.

Portarium evaluated the request. `email_send_client` is classified as HumanApprove tier. Aria was
suspended. Sarah Chen received a notification: "Aria proposes sending the attached email to Client
#A-4421. Draft content: [full text shown]. Proposed send time: now."

Sarah reviewed the draft. It was accurate. The tone was appropriate. She approved. Portarium
unblocked Aria, who sent the email and logged the confirmation.

Total elapsed time from ticket receipt to email send: eleven minutes. Of that, Aria's processing
time was under two minutes. Nine minutes was Sarah's review — including the thirty seconds she
spent reading the draft and the brief moment she spent confirming it matched what she would have
written herself.

**Outcome:** Approved. Email sent. Evidence record includes full draft text and Sarah's approval
rationale.

**Business insight.**
This scenario shows governance at its most routine — and its most valuable. The eleven-minute
turnaround is faster than most manual complaint resolution processes. Aria drafted something that
was immediately approvable. Sarah's role was not to rewrite the email; it was to confirm that an AI
had produced something she was prepared to put the firm's name on. That confirmation — and the
record of it — is what makes the governance layer real.

**Compliance note:**
FCA COBS 4: client communications must be approved by an appropriate person. Sarah Chen is the
named accountable officer for client communications under the firm's SM&CR policy. Her approval
satisfies this requirement. The evidence record is retained for regulatory purposes.

---

### Scenario 3: $2 Million NVDA Trade Proposal

**Agent:** Atlas (Finance AI)\
**Action requested:** Execute a buy order for 8,000 shares of NVIDIA Corporation (NVDA) at market
price, estimated value approximately $2,000,000, in the Nexus Global Growth mandate\
**Governance tier:** HumanApprove\
**Approver:** Marcus Webb (Head of Portfolio Management)

**Why it's consequential.**
A $2 million equity order is a binding financial obligation. If executed in error — wrong ticker,
wrong size, wrong mandate, or a signal that looked good but was built on bad data — the client
bears the loss and the firm bears the liability. The portfolio manager accountable for the mandate
is Marcus Webb. Under the firm's SM&CR obligations, Marcus bears personal accountability for
portfolio management decisions in his scope. An AI that could execute this trade without his
explicit sign-off would not be augmenting his judgement — it would be substituting for it without
his knowledge.

**What happened.**
At 2:31pm, Atlas detected a momentum signal in the Nexus Global Growth mandate. The position
analysis showed the mandate was underweight NVDA relative to its benchmark, and the signal met the
strategy's entry criteria. Atlas composed a trade proposal: 8,000 shares, NVDA, at market, with
full rationale including the signal parameters, the mandate's current position, the expected impact
on portfolio exposure, and the estimated execution cost.

Atlas proposed `trading_execute_order`. Portarium suspended Atlas and notified Marcus Webb.

Marcus was in a client meeting. His phone showed a governance notification: "Atlas proposes NVDA
buy 8,000 shares, market order, Global Growth mandate. Signal: momentum crossover at 2:28pm.
Current mandate weight: 2.1%. Benchmark weight: 3.4%. Proposed weight post-trade: 3.3%." He
stepped out briefly. The proposal looked clean. The signal matched what he had been tracking
himself. The sizing was within mandate limits. He approved from his phone and returned to the
meeting.

Atlas executed the order. The fill confirmation was logged at 2:34pm. Evidence record: Atlas's
proposal, full rationale, Marcus's approval decision, timestamp, and execution confirmation.

**Outcome:** Approved. Trade executed. Full evidence chain captured.

**Business insight.**
The governance layer did not slow this trade down by any material amount. The signal was detected
at 2:28pm. The order executed at 2:34pm. Six minutes — the time it took for Marcus to see the
notification and make a decision. The value is not speed; it is the decision record. If this trade
later became the subject of a client complaint or regulatory enquiry, Nexus can show exactly what
Atlas proposed, exactly what rationale it provided, and exactly when Marcus made his decision to
approve. That is the maker-checker principle in practice.

**Compliance note:**
FCA SYSC: material trading decisions require four-eyes authorisation. The evidence record satisfies
this requirement. SM&CR: Marcus Webb is the named accountable officer for portfolio management
decisions in the Global Growth mandate.

---

### Scenario 4: Emergency Production Deployment at 2:47am

**Agent:** Zeus (Operations AI)\
**Action requested:** Deploy a critical security patch for the trading engine middleware to
production\
**Governance tier:** HumanApprove\
**Approver:** David Park (Lead Platform Engineer, On-Call)

**Why it's consequential — and why 2:47am doesn't change that.**
A production deployment affects every system the firm relies on for client service and trading
operations. A failed deployment during market hours is an operational incident. A failed deployment
at 2:47am is an operational incident that starts at 2:47am. The fact that markets are closed and
most of the firm is asleep does not reduce the blast radius of a bad deployment — it potentially
increases it, because fewer people are available to respond.

The case for autonomous AI deployment sounds compelling in an emergency: it's faster, it reduces
the risk of the vulnerability being exploited overnight, and the AI has already verified the patch.
But "the AI verified it" is not the same as "a named, accountable engineer verified it and decided
to proceed." Those are different things. The governance framework applies at 2:47am for the same
reason it applies at 2:47pm.

**What happened.**
The on-call monitoring system detected an active CVE in the trading engine middleware. A patch had
been prepared and tested by the platform team the prior afternoon. Zeus, which had been monitoring
the vulnerability alert, assembled the deployment proposal: the patch version, the deployment
window, the rollback plan, the test results, and a risk assessment estimating low probability of
production impact.

Zeus proposed `infra_deploy_production`. Portarium suspended Zeus and fired the on-call alert to
David Park.

David's phone buzzed at 2:47am. He had expected this — he had been briefed on the patch the
previous afternoon and had reviewed the test results before leaving the office. The proposal on his
screen matched what he expected: the same patch, the same version, the same deployment window. He
read through Zeus's risk assessment — it was thorough and accurate — and approved.

Zeus deployed. The deployment completed successfully at 2:53am. David acknowledged the completion
alert and set a reminder to review the deployment logs in the morning. He went back to sleep at
2:54am.

The audit trail captured everything: Zeus's proposal at 2:47am, the full deployment context, David's
approval at 2:48am, his rationale ("patch matches reviewed version, test results clean, low-traffic
window"), and the completion confirmation at 2:53am.

**Outcome:** Approved. Patch deployed. Evidence record complete. David sleeping by 2:54am.

**Business insight.**
This is the scenario that matters most for understanding what AI governance means in practice.
Zeus had all the information it needed to deploy. The patch was ready. The window was correct. The
risk was low. And Zeus still waited for a human. Not because Zeus was incapable of proceeding, but
because the governance framework requires a human decision for production deployments — at any
hour, under any circumstances.

The alternative — an AI that deploys autonomously at 2:47am because it has assessed the risk as
low — is not a more capable system. It is a less governed one. The human who approves a 2:47am
deployment is the human who is accountable for that deployment. That accountability does not exist
if the AI acts alone.

David's six seconds of review and approval at 2:47am is not a bottleneck. It is a control. It is
the moment at which a named engineer looked at a consequential action and said: "Yes. Proceed." The
governance layer preserved that moment. The audit trail proves it happened.

**Compliance note:**
FCA SYSC 8: operational resilience. Production change management requires named technical
authorisation. The evidence record satisfies this requirement and provides evidence of the firm's
operational control framework.

---

### Scenario 5: Bulk Promotional Email Campaign — Denied

**Agent:** Aria (Customer Service AI)\
**Action requested:** Send a promotional email campaign to 847 clients advertising a new discretionary
management product tier\
**Governance tier:** HumanApprove\
**Approver:** Rachel Torres (Chief Compliance Officer)

**Why it's consequential — and why this one is different.**
This scenario is about a governance control catching something that should not proceed.

The request arrived through Aria's task queue, formatted as a standard client communications
request. The instruction described the campaign as a "client engagement initiative" and cited a
previous campaign as a template. It requested `email_send_bulk_campaign` to a segment of 847 clients.

A bulk email campaign to 847 regulated clients is not a routine client communication. It is a
financial promotion under FCA COBS 4 rules, and it requires specific disclosures, prior regulatory
approval in some cases, and documented sign-off from a senior compliance officer. It also raises
GDPR considerations: were these clients' contact preferences verified? Had any of them opted out of
marketing communications?

Aria did not evaluate any of this. She could not. She received an instruction, composed a campaign,
and proposed the action. That is what the governance layer is for.

**What happened.**
Aria proposed `email_send_bulk_campaign` with the campaign content and the 847-client recipient list.
Portarium suspended Aria and notified Rachel Torres, the CCO.

Rachel reviewed the proposal. Several things immediately concerned her. The campaign advertised
a product tier that had not yet received final FCA sign-off for marketing distribution. The
recipient list included clients in segments that had not consented to marketing communications.
And the instruction that had generated this proposal — when Rachel traced it back — had originated
from an external channel where an unknown party had submitted a task to Aria's queue.

Rachel denied the proposal. Her rationale: "Bulk promotional campaign for unapproved product.
Recipient list not verified for marketing consent. Potential regulatory violation. Do not proceed.
Investigate task origin."

Aria received the denial, logged it, and escalated the task origin investigation to the security
team.

**Outcome:** Denied. Campaign not sent. Governance violation flagged. Task origin under
investigation.

**Business insight.**
This scenario demonstrates that the governance layer is not just a maker-checker for legitimate
AI proposals — it is a compliance control that can catch proposals that should not have been made
at all. An AI that could send bulk campaigns autonomously would have sent this one. 847 clients
would have received a promotional email for an unapproved product. The regulatory exposure — and
the client trust damage — would have been significant.

The governance layer worked exactly as designed. Aria proposed an action she was authorised to
propose. Portarium escalated it to the appropriate human. The human caught the problem. The
evidence record captured everything: the proposal, the content, the rationale, and the explicit
denial with documented reasoning. If regulators ask later, "Did you have controls in place to
prevent AI systems from sending non-compliant financial promotions?", Nexus can answer: yes.
Here is the evidence record showing that those controls worked.

**Compliance note:**
FCA COBS 4: financial promotions require prior approval from an authorised person. The proposed
campaign promoted a product that had not received final FCA marketing sign-off. Rachel Torres's
denial satisfies the four-eyes requirement and creates the documented evidence that the firm's
compliance controls functioned correctly. GDPR: bulk marketing to clients without verified consent
is a potential breach of the UK GDPR's requirements around lawful basis for processing.

---

### Scenario 6: GDPR Client Data Erasure — Maker-Checker in Action

**Agent:** Aria (Customer Service AI)\
**Action requested:** Permanently delete all personal data for Client #C-0092 following a formal
GDPR Article 17 erasure request\
**Governance tier:** HumanApprove\
**Approver:** James Okafor (Data Protection Officer)

**Why it's consequential.**
Permanent data deletion is irreversible. Once the records are gone, they are gone — transaction
history, correspondence, account data, everything. Under GDPR Article 17, clients have the right
to erasure, and Nexus has an obligation to execute legitimate requests. But that obligation comes
with an equally important obligation: to document that a human — specifically, the Data Protection
Officer — made the decision to delete. "The AI did it" is not a compliant basis for erasure.

Additionally, GDPR erasure is not always straightforward. There are legitimate grounds to refuse
or delay erasure — for example, where the data must be retained for regulatory compliance purposes
(FCA requires transaction records to be kept for five to seven years). A named human, the DPO,
must evaluate whether the erasure request is valid and whether any retention exemptions apply.

**What happened.**
Client #C-0092 submitted a formal erasure request via the client portal. Aria received the request,
confirmed the client's identity, reviewed the account data in scope, and verified that no active
positions or open transactions existed that would complicate the deletion. Aria proposed
`db_delete_customer` for the client record.

Portarium evaluated the request. `db_delete_customer` is classified as HumanApprove tier with
James Okafor as the named approver. Portarium also enforced the maker-checker rule: the proposing
agent (Aria) and the approver must be different identities. Aria cannot approve her own deletion
proposals. James Okafor received the notification.

James reviewed the request. He confirmed the erasure request was legitimate and had been submitted
through the verified client portal. He checked the account status — no active positions, no open
regulatory holds, no pending transactions. He checked the retention schedule: the client had been
inactive for over seven years, satisfying the minimum retention obligation for their transaction
records. James approved the erasure.

Aria executed the deletion. The data was permanently removed. James received a deletion confirmation
for his records. The evidence record captured: the original erasure request, Aria's analysis and
proposal, James's review, his approval rationale, and the deletion confirmation — including the
timestamp the deletion was completed.

**Outcome:** Approved. Data permanently deleted. Full GDPR evidence chain created, retained per
regulatory requirements.

**Business insight.**
There is an apparent paradox here: Nexus deletes the data, but retains a record that the data was
deleted. This is intentional, and it is legally required. The GDPR evidence record does not contain
the deleted personal data — it contains metadata about the deletion: who requested it, who decided
to execute it, and when. That record is what the ICO would ask to see in an audit or an enforcement
investigation. "We deleted it, and here is the documented evidence that a named, accountable DPO
made that decision" is a compliant answer. "We deleted it" is not.

The maker-checker enforcement is equally important. Aria proposed the deletion; James approved it.
Two identities. The same person cannot propose and approve a data erasure — this prevents a scenario
where a misconfigured or manipulated AI deletes data without any independent human review. The
governance layer enforces this automatically, regardless of how the instruction reached Aria.

**Compliance note:**
GDPR Article 17: right to erasure. The evidence record demonstrates that the erasure was processed
in response to a legitimate client request and that a named, accountable DPO made the decision.
ICO enforcement guidance requires documented human oversight for data erasure operations. UK GDPR
Article 5(2): accountability principle — the controller must be able to demonstrate compliance.
This evidence chain is that demonstration.
