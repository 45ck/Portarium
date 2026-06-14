# Approval Packet v1

**Status:** Proposed
**Related Bead:** bead-1105

## Purpose

Approval packets give Cockpit and API clients a compact review object for
artifact-producing work. They keep the Artifact under review first, then attach
the markdown review material, requested capabilities, and Plan scope needed for
a human decision.

## Contract

`ApprovalPacketV1` is an optional field on `ApprovalV1` and
`CreateApprovalRequest`.

Required fields:

- `schemaVersion: 1`
- `packetId`
- `artifacts`: non-empty list with at least one `primary` Artifact reference
- `reviewDocs`: non-empty list of markdown documents
- `requestedCapabilities`: non-empty list of capability identifiers and reasons
- `planScope`: Plan ID, summary, Action IDs, and planned effect IDs

The Plan scope must support multiple Action IDs and multiple planned effect IDs.
Duplicate IDs are invalid.

## Cockpit Behaviour

When present, Cockpit renders the approval packet before the normal review tabs.
The primary Artifact is shown first, followed by Plan scope, requested
capabilities, and markdown review docs.

The packet must not be flattened into the approval `prompt` or repeated as the
top-card title. Cockpit should keep the top card compact and place packet
detail in the packet/detail surface. Long markdown review docs should be
collapsed, clipped, or otherwise secondary by default so operators can first
decide what kind of action they are reviewing.

## Acceptance Signals

- Creating an approval with a valid packet persists and returns the packet.
- Malformed packets fail at the API boundary with validation errors.
- Approval decisions preserve the packet on the stored approval.
- Cockpit review mode exposes the primary Artifact, markdown docs, requested
  capabilities, and multi-action Plan scope without requiring raw log review.
