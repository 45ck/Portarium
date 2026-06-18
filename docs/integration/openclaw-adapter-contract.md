# OpenClaw Adapter Contract

Portarium can govern OpenClaw-style runtimes without making the open-source core
specific to one operator, tenant, or deployment. This contract defines the
generic adapter surface that downstream integrations must preserve when they add
customer-specific aliases, standing-read scopes, approval-card templates, or
executor allowlists.

The machine-readable example lives at
`examples/openclaw/portarium-openclaw-adapter.contract.json` and is validated by:

```bash
npm run ci:openclaw-adapter-contract
```

## Contract Shape

An OpenClaw adapter must expose these layers as separate concepts:

| Layer                    | Requirement                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Tool alias manifest      | Chat-safe aliases map to stable bridge tool names. Aliases must be unique, lower-case, and deterministic.                 |
| Bridge principals        | Read-only, standing-read, approval-drafting, and executor principals are distinct. Unknown principals deny.               |
| Approval-card draft flow | Drafting creates a Cockpit review artifact and never executes the requested action.                                       |
| Executor gate            | Execution is direct-only, not chat-exposed, fail-closed for unknown tools, and dry-run by default.                        |
| Evidence timeline        | Proposal, policy decision, Cockpit visibility, approval decision, execution result, and evidence records stay correlated. |
| Cockpit visibility       | Pending, blocked, approved, rejected, dry-run, and executed states must be visible to operators.                          |

## Principal Model

Adapters must not collapse read, proposal, and execution authority into one
token or header. The generic contract requires four principals:

- `read-only`: status, inventory, capability, health, and evidence reads.
- `standing-read`: bounded reads with explicit scope, caps, redaction, freshness, and denied operations.
- `approval-drafting`: approval-card drafting and Cockpit mirroring only.
- `executor`: direct execution gate only.

The executor principal is the only executable principal. It must not be exposed
through hosted chat or any broad agent-facing alias list.

## Approval-Card Draft Flow

Approval cards are review artifacts, not approvals and not execution tokens by
themselves. A draft flow must include:

- exact action and scope
- policy decision and risk
- authority level
- evidence and source freshness
- rollback or handoff
- expiry and cap, where relevant
- Cockpit mirror status
- optional custom review views, such as flow diagrams, risk matrices, evidence
  maps, or operator-input checklists, rendered as review context only

If the adapter cannot prove that the card shown in Cockpit is the same card the
executor is about to use, the executor must fail closed and require the card to
be remirrored.

## Dry-Run Executor Gate

The executor gate must default to dry-run. Non-dry-run execution requires an
explicit execute flag plus whatever approval token, maker-checker, idempotency,
scope, and allowlist rules the downstream integration defines.

The generic contract intentionally does not define customer-specific actions.
It defines the minimum safety shape those actions must pass through.

## Evidence And Result Timeline

An adapter must keep a correlated timeline with at least these events:

1. proposal
2. policy decision
3. approval card drafted
4. Cockpit visible
5. approval decision
6. execution result
7. evidence recorded

Blocked work is still work. Blocked, denied, timed out, stale-card, and
fail-closed states must be visible in Cockpit and evidence, not hidden inside
agent chat output.

## Extending The Contract

Downstream integrations can add aliases and stricter policy fields, but must not:

- expose executor aliases to chat
- allow unknown tools or principals to pass through
- make approval-card drafting executable
- default executor calls to mutation
- hide blocked or pending work from Cockpit
- drop proposal, policy, decision, result, or evidence timeline records

For a customer-specific deployment, keep customer names, private source scopes,
hostnames, and operational secrets in the downstream adapter/config layer. The
Portarium core contract should stay tenant-neutral.
