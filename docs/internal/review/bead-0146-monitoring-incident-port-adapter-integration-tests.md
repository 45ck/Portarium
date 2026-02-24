# Bead-0146: MonitoringIncident Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/monitoring-incident/in-memory-monitoring-incident-adapter.integration.test.ts`

## Test Coverage Added

- Alert and incident flow: list/get/acknowledge/resolve alerts, then create/update/get incidents.
- Operations coordination flow: list/get/create schedules, list escalation policies, list/get services, create/update status pages, list maintenance windows, and send notifications.
- Validation/not-found flow: missing alert id, unknown alert resolution, and missing notification message.

## Verification

- `npm run test -- src/infrastructure/adapters/monitoring-incident/in-memory-monitoring-incident-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
