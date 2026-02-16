---
name: security-scan
description: Run security scans (npm audit + optional Semgrep) and write evidence to reports/security/.
disable-model-invocation: true
argument-hint: '[mode=pr|nightly]'
allowed-tools: Read, Grep, Glob, Bash(npm audit *), Bash(semgrep *)
---

# Security Scan

## Commands

- `npm audit --audit-level=high`
- If Semgrep is available: `semgrep --config p/ci`

## Evidence

- Write `reports/security/SECURITY_REPORT.md` with:
  - Findings summary
  - Remediation plan
