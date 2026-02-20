# Domain Parsing Toolkit v1

## Purpose

Define the shared parser contract for all domain `*V1` parsers in `src/domain/`.

## Contract

1. All `parse*V1` entry points must compose shared validation helpers from:
   - `src/domain/validation/parse-utils.ts`
2. Parsers must expose typed parser errors using the `<Thing>ParseError` naming convention.
3. Primitive shape checks must be centralized in `parse-utils` where possible:
   - object checks via `parseRecord` / `readRecord`
   - required strings via `readString`
   - optional strings via `readOptionalString`
   - booleans/integers/enums via corresponding `read*` helpers
4. Domain-specific invariants may add focused checks after shared parsing (for example, chronology or policy-specific constraints), but should not re-implement generic object/string parsing utilities.

## Verification Targets

- `src/domain/validation/parse-utils.test.ts`
- representative parser suites (for example):
  - `src/domain/adapters/adapter-registration-v1.test.ts`
  - `src/domain/approvals/approval-v1.test.ts`
  - `src/domain/event-stream/cloudevents-v1.test.ts`

## Error Model Alignment

- Parser modules throw explicit typed errors (`<Thing>ParseError`) for parse/shape failures.
- Error text includes field-level context to support deterministic diagnosis and test assertions.
