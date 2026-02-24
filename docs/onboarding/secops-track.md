# SecOps / Compliance Onboarding Track

**Audience:** Security engineers and compliance officers governing Portarium deployments.
**Time:** ~30 minutes.

---

## Learning Objectives

- Understand the evidence chain's tamper-evidence guarantees.
- Review the authorization model (OpenFGA, policy tiers, workload identity).
- Verify that security baselines are met before production sign-off.
- Know which audit artefacts satisfy SOC 2 / ISO 27001 control requirements.

---

## Track Steps

### 1. Evidence Chain Guarantees (10 min)

Every action in Portarium is recorded as an `EvidenceEntryV1`:

| Field           | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `evidenceId`    | Unique ID for this record                                    |
| `occurredAtIso` | Monotonic timestamp (verified on read)                       |
| `previousHash`  | SHA-256 of the prior entry (chain link)                      |
| `hashSha256`    | SHA-256 of this entry's canonical JSON                       |
| `actor`         | Who performed the action (User / Machine / Adapter / System) |
| `category`      | Plan / Action / Approval / Policy / PolicyViolation / System |
| `summary`       | Human-readable description                                   |

The chain is append-only. Gaps or hash mismatches indicate a tampering event.

**Verify a chain:**

```bash
node --input-type=module << 'EOF'
import { verifyEvidenceChain, sha256Hex } from './src/sdk/evidence-chain-verifier.js';
// Replace with actual entries from your evidence log API
const entries = [];
const r = verifyEvidenceChain(entries, { computeHash: sha256Hex });
console.log(r.ok ? 'CHAIN VALID' : `CHAIN BROKEN at index ${r.index}: ${r.reason}`);
EOF
```

### 2. Authorization Model (10 min read)

Portarium uses a two-layer authorization model:

**Layer 1 — OpenFGA (relationship-based access control)**

- All API calls are checked against an OpenFGA store.
- Relations: `workspace:member`, `workspace:admin`, `run:approver`, etc.
- Model is pinned per deployment (see `src/infrastructure/auth/`).

**Layer 2 — Policy Tiers (blast-radius control)**

| Tier           | Description                           | Approval required |
| -------------- | ------------------------------------- | ----------------- |
| `Auto`         | Read-only / classify only             | None              |
| `Assisted`     | Low-risk writes                       | None              |
| `HumanApprove` | Significant writes (invoice, payroll) | Yes               |
| `ManualOnly`   | Destructive / irreversible            | Always            |

Machine `workloadIdentity: 'Required'` ensures agents authenticate with
attested credentials — `none` auth is blocked for active machines.

### 3. Security Gate Verification (5 min)

```bash
# Run security baseline checks
npm run ci:security-gates

# Audit for high-severity npm vulnerabilities
node scripts/ci/audit-high.mjs
```

These are enforced on every PR; no high-severity CVEs are permitted.

### 4. Audit Artefacts for Compliance (5 min read)

| Control                  | Artefact                                       |
| ------------------------ | ---------------------------------------------- |
| Immutable audit log      | `EvidenceEntryV1` hash chain                   |
| Access control           | OpenFGA model + policy tier enforcement        |
| Change management        | Bead-tracked git commits with `Co-Authored-By` |
| Vulnerability management | `npm run audit:high` (zero-tolerance)          |
| Encryption in transit    | mTLS / Bearer token for machine auth           |
| Incident response        | Evidence `category: PolicyViolation` entries   |

### 5. Pre-Production Sign-Off Checklist

- [ ] `verifyEvidenceChain` returns `ok: true` on a sample of recent entries.
- [ ] OpenFGA model ID is pinned (not `latest`) in deployment config.
- [ ] No active machines use `authConfig: { kind: 'none' }`.
- [ ] `npm run audit:high` exits 0.
- [ ] All `HumanApprove` and `ManualOnly` workflow actions have approval records.
- [ ] Retention schedules are configured per `EvidenceRetentionScheduleV1`.

---

## References

- [ADR-0070: Hybrid orchestration + CloudEvents](../internal/adr/)
- [Evidence privacy minimization](../../src/domain/evidence/evidence-privacy-v1.ts)
- [OpenFGA authorization](../../src/infrastructure/auth/)
- [Security baseline gates](../how-to/security-baseline-gates.md)
