# bead-0042 ADR-0032 review: payload schema, versioning, and correlation IDs

## Review scope

- CloudEvents envelope mapping from domain events.
- Producer command boundary (run-start) CloudEvent attributes.
- Sink/consumer boundary (outbox dispatcher -> publisher) envelope pass-through.

## Evidence

- `src/application/events/cloudevent.ts` and `src/application/events/cloudevent.test.ts`
  - validates CloudEvents v1 envelope mapping (`specversion`, `type`, `source`, `subject`, `tenantid`, `correlationid`).
- Added producer-boundary assertions in `src/application/commands/start-workflow.test.ts`.
- Added sink-boundary assertions in `src/application/services/outbox-dispatcher.test.ts`.
- `src/domain/event-stream/cloudevents-v1.test.ts` validates parsing/required extension attrs and specversion handling.

## Outcome

- Event payload envelope and correlation propagation are verified across producer and sink boundaries.
- Versioning is enforced via CloudEvents `specversion: 1.0` and tested parser validation.
- Full `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
