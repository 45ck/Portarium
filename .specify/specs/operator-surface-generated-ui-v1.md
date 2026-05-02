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
- Form submissions carry primitive field values only.
- Surface approval is a prerequisite for operator use.
