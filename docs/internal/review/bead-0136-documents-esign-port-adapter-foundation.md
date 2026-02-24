# Bead-0136: DocumentsEsign Port Adapter Foundation

## Scope

- `src/application/ports/documents-esign-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/documents-esign/in-memory-documents-esign-adapter.ts`
- `src/infrastructure/adapters/documents-esign/in-memory-documents-esign-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for DocumentsEsign operations with the
  17-operation union from the port taxonomy.
- Implemented an in-memory DocumentsEsign adapter foundation covering:
  - document lifecycle operations (list/get/upload/delete/move/share);
  - folder and permissions operations (create/list folders, get/set permissions);
  - e-sign lifecycle operations (create/get/list signature requests, download signed document);
  - template and audit operations (create/list templates, get audit trail).
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/documents-esign/in-memory-documents-esign-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
