# Software Change Management Reference Pack

Reference vertical pack for ADR-0039.

The pack demonstrates:

- ticket-to-plan lifecycle orchestration,
- mandatory approval semantics for risky changes,
- immutable evidence bundle linkage,
- deployment trigger orchestration through pack workflow steps.

Artifacts are declarative and parsed by existing pack domain contracts:

- `pack.manifest.json`
- `schemas/change-control-extension.json`
- `workflows/change-request-lifecycle.json`
- `ui-templates/change-request-form.json`
- `mappings/change-ticket-mapping.json`
- `tests/change-evidence-fixture.json`
