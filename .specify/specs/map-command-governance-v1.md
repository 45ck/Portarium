# Map Command Governance v1

## Purpose

Define governance behavior for high-risk commands initiated from map context.

## Scope

High-risk map command intents:

- `RemoteStop` (maps to `robot:estop_request`)
- `RestrictedZoneMove` (maps to `robot:execute_action` in restricted/hazard zones)

## Application Boundary

`submitMapCommandIntent` is the use-case boundary for map command governance.

Before any execution dispatch, it must:

1. authorize caller for map command submission
2. evaluate policy tier and SoD constraints
3. write immutable `Policy` evidence for command intent and decision trail
4. emit a policy-evaluated event for audit consumers

## Gating Rules

- SoD violations are rejected with explicit violation reason.
- Policy decisions of `RequireApproval` return a gate result requiring approval.
- Policy decisions of `Deny` reject command intent.
- Only `Allow` returns an accepted command intent.

## Audit Trail Requirements

Each command intent evidence entry includes:

- map context reference (site/floor/zone/layer)
- robot reference
- approving actor references when provided
- policy decision metadata

This links map context to the decision trail for governance auditability.
