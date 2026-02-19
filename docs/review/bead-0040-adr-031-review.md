# bead-0040 ADR-0031 review: requestor/approver separation and N-role pre-transition enforcement

## Review focus

- Verify SoD checks execute before any approval state transition.
- Verify requestor/approver separation (maker-checker) and distinct-approver thresholds block transitions.

## Evidence and changes

- Existing command flow in `src/application/commands/submit-approval.ts` performs SoD guard before `buildDecidedApproval()` and before persistence/event publication.
- Added regression tests in `src/application/commands/submit-approval.test.ts`:
  - maker-checker self-approval is rejected;
  - distinct-approvers threshold unmet is rejected;
  - both assert no save and no publish occurred.

## Outcome

- Requestor/approver separation and N-role constraints are enforced before transition side effects.
- Full `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
