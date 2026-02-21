---
name: security-scan
description: Run security scans and write a security evidence report.
disable-model-invocation: true
argument-hint: '[mode=pr|nightly]'
allowed-tools: Read, Grep, Glob, Bash(npm audit *), Bash(npm sbom *)
---

# Security Scan

## Outputs

- `reports/security/SECURITY_REPORT.md`
- `reports/security/sbom.json`

## Steps

1. Run `npm audit --audit-level=high` — report vulnerabilities.
2. Generate SBOM: `npm sbom --sbom-format cyclonedx > reports/security/sbom.json`
3. If Semgrep is available: run `semgrep --config p/ci src/` — fail on findings.
4. Write `reports/security/SECURITY_REPORT.md` summarising:
   - Vulnerability count by severity
   - SBOM generated (yes/no)
   - Semgrep findings (if run)
   - Remediation actions required
