# Cockpit Lo-Fi v2: Workforce/People Directory

Bead: `bead-0534`  
Scope: Workforce/People directory as first-class resource surface under Configuration.

## Wireframe Artifact

- Primary artifact: `docs/ui/cockpit/index.html` (Workforce views)
- Visual captures:
- `docs/ui/cockpit/screenshots/heuristic-03-workforce-directory.png`
- `docs/ui/cockpit/screenshots/heuristic-04-workforce-bob-detail.png`
- `docs/ui/cockpit/screenshots/heuristic-05-workforce-carol-detail.png`

## Annotated States

- Directory list:
- Columns: member name, availability badge, capability chips, queue membership count.
- Empty/onboarding:
- CTA to register first workforce member; helper copy points to Settings > Workforce.
- Profile drawer:
- Member identity, capability chips, queue memberships, assignment/evidence history.
- Persona adaptation:
- `admin`: editable capability controls.
- `operator`/`approver`: read-only profile and history.

## Nielsen Heuristics Note

- Visibility of system status: availability badges and stale-data indicator are persistent.
- Match between system and real world: terminology follows glossary (`Workforce Member`, `Queue`, `Human Task`).
- User control and freedom: drawer close, clear filters, reversible edits.
- Consistency and standards: same list/detail layout pattern as Machines and Agents.
- Error prevention: capability edits gated to admin role and validated vocab.

## Reviewer Sign-Off

- Reviewer: Principal Engineer (MQCKENC)
- Status: Approved for implementation (`bead-0545`)
