# Supply-Chain Guardrails for Cockpit and Connector Dependencies

> **Audience**: Maintainers, release managers, and security engineers.
>
> **Goal**: Establish automated supply-chain controls that detect vulnerable, malicious,
> or license-incompatible dependencies before they reach `main`.

---

## 1. Threat model

| Threat                                            | Attack vector             | Control                              |
| ------------------------------------------------- | ------------------------- | ------------------------------------ |
| Known vulnerability in transitive dep             | npm audit / CVE database  | `npm audit --audit-level=high` in CI |
| Malicious package (typosquat, hijack)             | npm registry              | Lockfile pinning + integrity checks  |
| License violation (GPL in production bundle)      | Accidental dep upgrade    | `license-checker` gate               |
| Outdated dep with unpatched CVE                   | Stale lockfile            | Weekly Dependabot / Renovate alerts  |
| Compromised dev dep leaking into production build | No prod/dev separation    | `--production` flag on audit         |
| Supply-chain attack via CI script                 | Compromised GitHub Action | Pin Actions by SHA, not tag          |

---

## 2. CI gates (run on every PR)

### 2.1 Vulnerability gate (already in `ci:pr`)

```bash
# scripts/ci/audit-high.mjs (existing)
npm audit --audit-level=high --production
```

- Fails on any HIGH or CRITICAL CVE in production dependencies
- Dev-only vulnerabilities are warnings, not failures (update weekly)

### 2.2 License gate

```bash
# Add to ci:pr
npx license-checker --production \
  --onlyAllow "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;MPL-2.0;CC0-1.0;Unlicense;0BSD;Python-2.0" \
  --excludePrivatePackages
```

See `docs/how-to/licensing-gate.md` for the full compliance checklist.

### 2.3 Lockfile integrity

`package-lock.json` (or `bun.lock`) must be committed and must not have unresolved
integrity hashes. Add to CI:

```bash
# Verify lockfile is up to date (fails if package.json changed without lockfile update)
npm ci --dry-run
```

---

## 3. Dependency pinning policy

### 3.1 Production dependencies

- Pin to **exact versions** (`"lodash": "4.17.21"` not `"^4.17.21"`) for all
  production dependencies where supply-chain risk is high (auth libraries, crypto, HTTP).
- Use `^` for well-maintained, low-risk utilities with frequent patch releases.

### 3.2 Dev dependencies

- `^` ranges acceptable for dev deps (ESLint, Vitest, TypeScript).
- Renovate/Dependabot handles automated updates.

### 3.3 GitHub Actions pinning

All GitHub Actions in `.github/workflows/` must be pinned to a full SHA:

```yaml
# Good
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

# Bad — tag can be moved maliciously
- uses: actions/checkout@v4
```

---

## 4. Cockpit-specific controls

### 4.1 Bundle analysis

After each Cockpit build, check for unexpected large or suspicious packages:

```bash
# apps/cockpit
npx vite-bundle-visualizer
# or
npx @next/bundle-analyzer  (if using Next.js)
```

Flag any package > 500 KB that wasn't explicitly reviewed.

### 4.2 Script integrity (CDN resources)

If any CDN-hosted resource is used in `index.html`, it **must** include a Subresource
Integrity (SRI) hash:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

Prefer: bundle all dependencies locally (no CDN at runtime).

### 4.3 Content Security Policy

Add a CSP header to the Cockpit dev server and production build:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.portarium.dev;
  img-src 'self' data:;
  font-src 'self';
  frame-ancestors 'none'
```

---

## 5. Connector/adapter dependency controls

Each MIS adapter (connector) may ship its own `package.json`. Apply the same gates:

```bash
# scripts/ci/audit-connectors.mjs
# Walk .trees/*/package.json (worktrees) — skip; these are dev-time
# Walk adapters/*/package.json (if connector packages exist)
find adapters -name package.json -not -path '*/node_modules/*' | while read f; do
  dir=$(dirname "$f")
  echo "Auditing $dir"
  npm audit --prefix "$dir" --audit-level=high --production
done
```

---

## 6. Incident response playbook

**If a vulnerability is discovered in a production dep:**

1. `npm audit fix` — attempt automatic patch
2. If no fix available: assess exploitability (is the vulnerable code path reachable?)
3. If exploitable: open a CRITICAL bead immediately, block release
4. If not exploitable: open a HIGH bead, fix within 14 days
5. Document in `docs/compliance/security-incident-log.md`

**If a malicious package is suspected:**

1. Remove the package from `package.json` and lockfile immediately
2. Rotate any credentials that may have been accessed during the infected period
3. Review git history for any code changes that may have been injected
4. File a report with the npm registry security team

---

## 7. Automated updates

Configure Renovate (or Dependabot) in `.github/renovate.json`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "schedule": ["every week"],
  "automerge": false,
  "labels": ["dependencies"],
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "automerge": true,
      "automergeType": "pr",
      "requiredStatusChecks": ["ci:pr"]
    },
    {
      "matchDepTypes": ["dependencies"],
      "automerge": false,
      "reviewers": ["team:security"]
    }
  ]
}
```

---

## 8. Related documents

| Document                                         | Purpose                          |
| ------------------------------------------------ | -------------------------------- |
| `docs/how-to/licensing-gate.md`                  | License compliance checklist     |
| `docs/how-to/security-baseline-gates.md`         | Security pre-release gates       |
| `docs/adr/ADR-0080-credential-boundary-model.md` | Credential isolation             |
| `scripts/ci/audit-high.mjs`                      | Existing vulnerability CI script |
