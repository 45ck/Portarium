# Licensing Gate: Third-Party Workflow UI/Components Compliance Checklist

> **Audience**: Release manager, legal counsel (if available), and senior maintainer.
>
> **Goal**: Ensure all third-party UI libraries, workflow components, and runtime
> dependencies used in Portarium are license-compatible with the project's chosen
> license before any public release.

---

## 1. Project license context

| Artefact | License | Notes |
|----------|---------|-------|
| Portarium core (`src/`) | TBD — confirm before release | Must be OSI-approved |
| Cockpit (`apps/cockpit/`) | TBD — confirm before release | May differ from core |
| SDK helpers (`src/sdk/`) | Must match or be more permissive than core | Adapter authors need to import these |

> **Action**: Confirm and commit a `LICENSE` file at repo root before the first public
> release (see gate checklist section 6).

---

## 2. Dependency categories and compatibility matrix

### 2.1 Copyleft compatibility

| License | Compatible with MIT | Compatible with Apache-2.0 | Notes |
|---------|--------------------|--------------------------|-|
| MIT | ✅ | ✅ | |
| ISC | ✅ | ✅ | Functionally equivalent to MIT |
| BSD-2-Clause | ✅ | ✅ | |
| BSD-3-Clause | ✅ | ✅ | |
| Apache-2.0 | ✅ (with notice) | ✅ | Patent clause — note in NOTICE file |
| MPL-2.0 | ✅ (file-level copyleft) | ✅ | Do not modify MPL files |
| LGPL-2.1 | ✅ (dynamic link only) | ✅ (dynamic link only) | No static bundling of LGPL code |
| GPL-2.0 / GPL-3.0 | ❌ (infects distribution) | ❌ | **Hard block** for proprietary distribution |
| AGPL-3.0 | ❌ | ❌ | **Hard block** — network use triggers |
| CC-BY-SA | ❌ (for code) | ❌ (for code) | Acceptable for docs only |
| Proprietary / EULA | ❌ | ❌ | **Hard block** unless commercial license obtained |

### 2.2 Special cases

- **Dual-licensed packages** (e.g. `some-lib` available under GPL + Commercial): use the
  commercial license or find an MIT alternative.
- **Font/icon licenses**: OFL (SIL Open Font License) is permissive; check icon pack
  licenses separately (e.g. Font Awesome Pro requires a paid license).
- **Data files** (JSON schemas, locale files bundled in npm packages): check separately —
  some use CC-BY or custom licenses.

---

## 3. Audit procedure

### 3.1 Automated scan (run before every release)

```bash
# Install license-checker (dev dep)
npx license-checker --production --onlyAllow \
  "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;MPL-2.0;Python-2.0;CC0-1.0;Unlicense;0BSD" \
  --excludePrivatePackages \
  --out docs/compliance/license-report.csv
```

Add to `ci:nightly`:
```json
// package.json scripts
"license:check": "license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;MPL-2.0;CC0-1.0;Unlicense;0BSD' --excludePrivatePackages"
```

### 3.2 Manual review (for flagged packages)

For any package flagged by the automated scan:

1. Read the full license text (not just the SPDX identifier — some packages mis-declare).
2. Check if the package is used at runtime (production dependency) or build/test only.
   - Build/test-only: LGPL/GPL may be acceptable (not distributed).
3. Check the package's issue tracker for dual-licensing options.
4. Document the decision in `docs/compliance/license-exceptions.md`.

### 3.3 Cockpit UI components

Key libraries to verify (update as deps change):

| Library | Expected license | Status | Notes |
|---------|-----------------|--------|-------|
| React | MIT | ✅ | |
| Tailwind CSS | MIT | ✅ | |
| Radix UI | MIT | ✅ | |
| Lucide Icons | ISC | ✅ | |
| Recharts | MIT | ✅ | |
| react-flow / xyflow | MIT | ✅ check version | Pro features are proprietary |
| Temporal SDK | MIT | ✅ | |
| Vitest | MIT | ✅ | |
| ESLint plugins | Varies | 🔍 Verify | Some plugins are GPL |

---

## 4. Third-party notices

All Apache-2.0 and BSD-3-Clause dependencies require a `NOTICE` file or attribution
in the distribution. Maintain `NOTICE.md` at repo root:

```markdown
# Third-Party Notices

This product includes software developed by third parties.
See individual package licenses in node_modules/{package}/LICENSE.

Notable attributions:
- [package-name] — Apache-2.0 — Copyright [year] [author]
```

---

## 5. Workflow UI component compliance

If a visual workflow editor is integrated (e.g. ReactFlow, n8n embed, or Retool Workflows):

| Component | License model | Action |
|-----------|--------------|--------|
| ReactFlow (xyflow) community | MIT | ✅ — no action needed |
| ReactFlow Pro | Proprietary subscription | ❌ — do not use Pro features in OSS distribution |
| n8n embed | Sustainable Use License (SUL) | 🔍 — legal review required; SUL restricts commercial SaaS |
| Retool | Proprietary | ❌ — not suitable for OSS core |
| BPMN.io (bpmnjs) | MIT | ✅ |

> See `docs/adr/` for the decision record on which workflow editor was selected
> (bead-0749 / bead-0753).

---

## 6. Release gate checklist

Before tagging any public release:

- [ ] `LICENSE` file exists at repo root (MIT recommended for core)
- [ ] `NOTICE.md` updated with Apache-2.0 / BSD-3-Clause attributions
- [ ] `npm run license:check` exits 0 (no GPL/AGPL/proprietary in production deps)
- [ ] `docs/compliance/license-report.csv` committed and reviewed
- [ ] Any exceptions documented in `docs/compliance/license-exceptions.md`
- [ ] Cockpit UI components list reviewed (section 3.3)
- [ ] Workflow editor component license confirmed (section 5)
- [ ] Release manager sign-off recorded in release PR description

---

## 7. Related documents

| Document | Purpose |
|----------|---------|
| `docs/compliance/` | Compliance artefacts directory |
| `docs/how-to/security-baseline-gates.md` | Security pre-release gates |
| `docs/how-to/technical-adopter-gtm.md` | GTM readiness |
| `docs/adr/` | Architecture decision records |
