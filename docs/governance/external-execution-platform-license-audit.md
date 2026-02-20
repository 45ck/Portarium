# External Execution Platform Licence Compliance Audit

Date: 2026-02-20
Bead: `bead-0414`

## Scope

Audit license and commercial-boundary risk for adopted external execution platforms:

- Activepieces
- Kestra
- StackStorm
- Langflow

This audit is an engineering governance artifact, not legal advice.

## Summary

All four selected platforms have permissive OSS cores (MIT or Apache-2.0).
Primary risk is not copyleft in core runtime; the risk is accidental dependency on
enterprise/hosted-only features or mixed-license plugin ecosystems.

## Findings

| Platform | OSS core license | EE/commercial boundary | Multi-tenant or distribution risk flags | Safe-use guideline |
| --- | --- | --- | --- | --- |
| Activepieces | MIT (core) | Commercial EE/cloud feature surface exists | Risk if Portarium critical path depends on EE-only capability | Use OSS core for critical path. Treat EE features as optional and contract-gated. |
| Kestra | Apache-2.0 (core) | Commercial editions/features exist | Risk if deployment or governance controls assume proprietary edition | Keep control-plane-critical behavior on Apache-2.0 feature set. |
| StackStorm | Apache-2.0 | Primarily OSS distribution | Lower license risk in core; plugin ecosystem still requires checks | Allow in OSS path, but scan packs/plugins before adoption. |
| Langflow | MIT | Hosted/commercial variants may exist outside OSS repo | Risk if hosted-only terms constrain deployment or tenant model | Use self-hosted MIT runtime for core path; treat hosted SKU terms separately. |

## Required Controls

1. Source pinning and SPDX capture

- For each runtime and plugin package, store version/commit and SPDX identifier in intake artifacts.

2. Critical-path permissive-only rule

- Control-plane correctness must not depend on non-permissive or commercial-only features.

3. Plugin/extension license scanning

- Scan runtime plugins/pieces/packs before enablement.
- Block GPL/AGPL and unknown licenses from production allowlists unless approved by legal.

4. Hosted and EE boundary review

- Any hosted/EE feature adoption requires explicit commercial/legal approval.
- Maintain a written "feature boundary" list separating allowed OSS features from restricted features.

5. Attribution and notice hygiene

- Preserve required attribution and NOTICE files for Apache-2.0 components.

## Platform-Specific Safe-Use Notes

- Activepieces: do not make EE-only connector behavior a prerequisite for adapter conformance.
- Kestra: keep workflow/runtime assumptions compatible with OSS edition.
- StackStorm: review third-party packs before promotion to shared environments.
- Langflow: enforce self-hosted deployment isolation and avoid hosted-only feature lock-in.

## Decision

Approved for continued adoption under the controls above.
Any move to EE/hosted features requires a follow-on legal/commercial review bead.
