# bead-0389 review: evidence payload WORM storage controls

## Scope

Verify acceptance criteria for:

- S3 Object Lock style retention controls
- legal hold behavior
- compliance mode coverage

## Findings

Implemented controls are present and aligned with AC.

1. S3 WORM controls implementation

- `src/infrastructure/evidence/s3-worm-evidence-payload-store.ts`
  - maps retention classes to lock modes (`Operational -> GOVERNANCE`, others -> `COMPLIANCE`)
  - applies retention using `PutObjectRetentionCommand`
  - applies legal hold using `PutObjectLegalHoldCommand`
  - maps Object Lock delete failures to `EvidencePayloadDeletionBlockedError`

2. Compliance mode test coverage

- `src/infrastructure/evidence/s3-worm-evidence-payload-store.test.ts`
  - verifies `COMPLIANCE` mode is sent to S3 retention API
  - verifies legal hold API call is issued

3. Legal-hold deletion blocking behavior

- `src/infrastructure/evidence/in-memory-worm-evidence-payload-store.test.ts`
  - verifies deletion is blocked while legal hold is active
  - verifies hold takes precedence over elapsed retention
  - verifies behavior after legal hold release

## Validation run

- `npm run typecheck` passed
- `npm run test` passed
- `npm run ci:pr` remains blocked by pre-existing repository-wide lint debt unrelated to bead-0389

## Conclusion

Acceptance criteria for `bead-0389` are satisfied by the existing implementation and tests.
