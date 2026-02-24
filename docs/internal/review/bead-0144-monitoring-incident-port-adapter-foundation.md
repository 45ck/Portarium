# Bead-0144: MonitoringIncident Port Adapter Foundation

## Scope

- `src/application/ports/monitoring-incident-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/monitoring-incident/in-memory-monitoring-incident-adapter.ts`
- `src/infrastructure/adapters/monitoring-incident/in-memory-monitoring-incident-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for MonitoringIncident operations with the
  18-operation union from the port taxonomy.
- Implemented an in-memory MonitoringIncident adapter foundation covering:
  - alert operations (`list/get`, `acknowledge`, `resolve`);
  - incident lifecycle operations (`list/get/create/update`);
  - operational coordination operations (`list/get/create on-call schedules`,
    `list escalation policies`, `list/get services`);
  - status and communication operations (`create/update status pages`,
    `list maintenance windows`, `sendNotification`).
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/monitoring-incident/in-memory-monitoring-incident-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
