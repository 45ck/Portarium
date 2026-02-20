# bead-0182 policy/SoD fault-injection review

## Scope

Add targeted fault-injection test evidence for policy and SoD logic before bead closure.

## Added Tests

- `src/domain/services/policy-sod-fault-injection.test.ts`

Coverage focus:

1. Mixed-violation severity precedence (`Deny` vs `RequireApproval`).
2. Safety-tier recommendation interaction with SoD deny conditions.
3. Multi-policy aggregation under adversarial constraint combinations.
4. Approval-routing SoD with duplicated approver history for remote E-stop requester separation.

## Verification

- `npm run test -- src/domain/services/policy-sod-fault-injection.test.ts src/domain/services/policy-evaluation.test.ts src/domain/policy/sod-constraints-v1.test.ts`

## Result

Pass. Fault-injection paths for policy/SoD evaluation are covered and green.
