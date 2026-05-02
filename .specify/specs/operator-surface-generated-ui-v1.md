# Governed Agent-Generated Operator Surfaces v1

## Purpose

Agents may propose temporary operator cards, forms, or panels when the standard
Cockpit approval and run views are not expressive enough. These surfaces are
structured UI data only. Rendering them must not require executing generated
JavaScript, HTML, plug-in code, or remote frame content.

## Contract

- The canonical schema is `OperatorSurfaceV1`.
- A surface is attributable to a `Run` context or an `Approval` context.
- Attribution records the proposing actor, proposal time, and rationale.
- Lifecycle state is ordered as `Proposed -> Approved -> Rendered -> Used`.
- Cockpit renders only `Approved`, `Rendered`, or `Used` surfaces.
- Operator interactions are captured as `OperatorSurfaceInteractionV1` with an
  action declared by the surface and an intent kind of `Intent`, `Taste`, or
  `Insight`.
- `OperatorSurfaceV1` is closed by default: undeclared fields are rejected
  rather than ignored.
- `OperatorSurfaceInteractionV1` may submit values only for declared form field
  IDs and derives `intentKind` from the approved surface action, not from the
  submitted payload.

## Evidence Semantics

Each lifecycle transition records `OperatorSurface` evidence linked to the
originating run and, when present, approval. The payload reference points to an
immutable operator-surface snapshot. This records when the generated surface was
proposed, approved, rendered, and used without widening plug-in governance or
policy workflow responsibilities.

## Safety Rules

- Only declared block types may be rendered: text, key-value list, metric, form,
  and actions.
- Executable hints such as `script`, `scriptUrl`, `code`, `html`,
  `dangerouslySetInnerHTML`, `iframeUrl`, and inline event handler fields are
  rejected by the domain parser.
- Form submissions carry primitive field values only, and those values must
  match the declared field widget contract.
- Surface approval is a prerequisite for operator use.
- Generated surfaces must not declare Browser Egress, external routes,
  extension activation grants, credentials, Host/API Origin changes, direct
  command execution, or privileged Control Plane authority. Those powers remain
  outside this schema and are governed by Cockpit Extension Host and Control
  Plane contracts.

## Threat Model

Agent-generated operator surfaces are untrusted input until parsed, approved,
rendered, and recorded as evidence. The main abuse paths are:

- **Executable payloads:** generated data tries to smuggle JavaScript, HTML,
  remote frame content, dynamic imports, inline event handlers, or form action
  URLs into Cockpit.
- **Hidden privileged commands:** generated data adds undeclared fields such as
  command IDs, API scopes, Browser Egress origins, extension grants, or
  credential references next to otherwise valid UI fields.
- **Content-driven unsafe action:** generated copy asks the operator or model to
  ignore Policy, Approval Gate, SoD, evidence, or tenant boundaries.
- **Misleading operator UX:** duplicated field/action IDs, mismatched labels,
  hidden form values, or non-declared select values make one action appear to be
  another.
- **Cross-run or cross-tenant leakage:** submitted interactions reference a
  different Workspace, Run, Approval Gate, or surface than the approved surface
  snapshot.

Mitigations required by this contract:

- Parse with a closed schema and fail on unknown fields before rendering.
- Treat all rendered text and labels as text content, never executable markup.
- Bind every interaction to the approved surface ID, Workspace, Run, and
  Approval Gate context.
- Resolve allowed actions only from the approved surface snapshot.
- Reject values for undeclared fields, prototype-pollution keys, wrong widget
  types, and select values outside declared options.
- Preserve immutable `OperatorSurface` evidence for proposal, approval,
  rendering, and use.

## Rollout Gate

Broader rollout is blocked until hardening evidence is acceptable. At minimum,
the evidence set must include passing negative tests for executable payloads,
hidden privileged command fields, form-value smuggling, mismatched
Workspace/Run/Approval Gate context, misleading duplicate IDs, and inert Cockpit
rendering. Pilot usage may continue only for schema-driven surfaces that pass
the v1 parser and renderer contract tests.
