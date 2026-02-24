# Bead-0138: DocumentsEsign Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/documents-esign/in-memory-documents-esign-adapter.integration.test.ts`

## Test Coverage Added

- Document lifecycle flow: list/get document, create/list folder, upload/move/share/delete document, and post-delete not-found verification.
- Signature workflow flow: set/get permissions, create/get/list signature requests, download signed document, and stable audit-trail retrieval.
- Template flow: create/list templates with tenant-scoped assertions.
- Validation/not-found flow: missing move payload fields, invalid permission entries, missing signature request id, and unknown source document for signature creation.

## Verification

- `npm run test -- src/infrastructure/adapters/documents-esign/in-memory-documents-esign-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
