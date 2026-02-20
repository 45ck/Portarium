# Start-To-Finish Execution Order Runbook

This runbook defines execution order and ownership from Domain Atlas through adapters, control plane API, and evidence pipeline.

## Ownership Model

- Domain Atlas owner: Platform Domain team (`domain-owner`)
- Adapter families owner: Integration team (`integration-owner`)
- Control plane API owner: Application + Presentation team (`api-owner`)
- Evidence pipeline owner: Governance + Infrastructure team (`evidence-owner`)
- Program integrator: Principal Engineer (`pe-owner`)

## Ordered Execution

1. Domain Atlas intake and mapping baseline
   - Owner: `domain-owner`
   - Outputs: CIF artifacts, canonical mappings, capability assumptions.
2. Domain model and invariant alignment
   - Owner: `domain-owner`
   - Outputs: aggregate invariants, parser coverage, docs alignment.
3. Adapter family implementation by priority
   - Owner: `integration-owner`
   - Outputs: family adapters, contract tests, fixture evidence.
4. Control plane API parity and boundary behavior
   - Owner: `api-owner`
   - Outputs: command/query handlers, contract parity, Problem Details behavior.
5. Evidence and governance hardening
   - Owner: `evidence-owner`
   - Outputs: evidence chain continuity, retention controls, review artifacts.
6. Cross-layer verification and gate pass
   - Owner: `pe-owner`
   - Outputs: architecture guard evidence, test/gate summaries, closure decisions.

## Bead Flow Rules

1. Claim bead before implementation.
2. Complete one bead at a time.
3. Add/update tests and docs with behavior changes.
4. Record review evidence in `docs/review/`.
5. Close bead only after acceptance evidence is present.

## Evidence Pipeline Touchpoints

- Every completed execution slice must produce:
  - test evidence,
  - review evidence,
  - updated bead/audit artifacts.
- Weekly and metadata bead audits must be regenerated after bead state transitions.
