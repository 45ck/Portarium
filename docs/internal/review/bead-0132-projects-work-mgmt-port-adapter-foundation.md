# Bead-0132: ProjectsWorkMgmt Port Adapter Foundation

## Scope

- `src/application/ports/projects-work-mgmt-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/projects-work-mgmt/in-memory-projects-work-mgmt-adapter.ts`
- `src/infrastructure/adapters/projects-work-mgmt/in-memory-projects-work-mgmt-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for ProjectsWorkMgmt operations with the
  21-operation union from the port taxonomy.
- Implemented an in-memory ProjectsWorkMgmt adapter foundation covering:
  - project operations (`listProjects`, `getProject`, `createProject`);
  - task operations (`listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `assignTask`);
  - structural operations (`list/getBoards`, `list/getSprints`, `createSprint`, `list/getMilestones`, `listLabels`);
  - collaboration/time operations (`listComments`, `addComment`, `listTimeEntries`, `logTime`).
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/projects-work-mgmt/in-memory-projects-work-mgmt-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
