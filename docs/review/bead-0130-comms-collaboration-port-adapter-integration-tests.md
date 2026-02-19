# Bead-0130: CommsCollaboration Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/comms-collaboration/in-memory-comms-collaboration-adapter.integration.test.ts`

## Test Coverage Added

- Messaging flow: send/list messages and message thread retrieval.
- Channel and user flow: list/get users, create/archive channel, and add user to channel.
- Collaboration flow: send/list email, create/get/list meetings, create/list calendar events, and upload/list files.
- Validation flow: missing required payload fields for thread lookup, channel membership, and calendar event creation.

## Verification

- `npm run test -- src/infrastructure/adapters/comms-collaboration/in-memory-comms-collaboration-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
