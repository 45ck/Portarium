# ADR-0114: n8n Embed vs Native Cockpit Workflow Editor

**Beads:** bead-0753
**Status:** Accepted
**Date:** 2026-02-23

## Context

Portarium needs a visual workflow editor for its governance cockpit. Two paths
exist: (1) embed n8n's editor UI via the n8n Embed programme, or (2) continue
building the native ReactFlow-based workflow builder already in the codebase.

This evaluation is required by ADR-0078 (Reuse vs Build Strategy) which deferred
the specific n8n Embed decision to this bead.

## Evaluation Criteria

### 1. Licensing

| Criterion            | n8n Embed                                                | Native (ReactFlow)          |
| -------------------- | -------------------------------------------------------- | --------------------------- |
| Base licence         | Sustainable Use License (SUL)                            | MIT (@xyflow/react)         |
| Commercial embedding | Requires separate n8n Embed agreement with per-seat fees | No restrictions             |
| SaaS distribution    | SUL prohibits distributing n8n as a SaaS product         | MIT allows any distribution |
| Source availability  | Source-available, not OSI-approved                       | MIT, OSI-approved           |
| OSS compatibility    | Incompatible with MIT/Apache-2.0 distribution            | Fully compatible            |

**Verdict:** n8n Embed requires a commercial agreement with ongoing fees and
restricts how Portarium can be distributed. The native editor has zero licensing
constraints. This is a **hard blocker** for the default distribution path per the
licensing gate (docs/how-to/licensing-gate.md, section 5).

### 2. Domain Model Alignment

| Aspect            | n8n Embed                                              | Native                                                              |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Node types        | Generic (HTTP, code, function, 400+ integrations)      | Domain-specific (ApprovalGate, AgentTask, Condition, Notification)  |
| Execution tiers   | Not supported; all nodes execute uniformly             | Built-in Auto/Assisted/HumanApprove/ManualOnly per node             |
| Approval gates    | Must be simulated via webhook wait + external callback | First-class node type with policy binding                           |
| Evidence model    | No concept of evidence/audit trail                     | Workflow actions map to Portarium evidence chain                    |
| Port families     | Foreign concept                                        | Each node derives its portFamily (Governance, MachineInvoker, etc.) |
| Workspace tenancy | Separate user/project model, requires bridge           | Uses Portarium WorkspaceId natively                                 |

**Verdict:** n8n's generic automation model does not map to Portarium's
governance-first domain. Embedding n8n would require an extensive adapter layer
to translate between n8n's execution model and Portarium's approval/evidence/tier
semantics, effectively building a second workflow engine on top of n8n.

### 3. Current Native Editor Maturity

The existing native workflow builder is functional and domain-aligned:

- **11 components** (544 LOC) across 7 node types: Start, End, Action,
  ApprovalGate, Condition, Notification, AgentTask
- **Step palette** with drag-and-drop onto canvas
- **Config panel** for per-node properties (name, description, timeout, retry,
  execution tier)
- **Validation panel** with real-time readiness checks (has start/end, all
  connected, no orphans)
- **Load/save** from Portarium API (`useWorkflow` / `useUpdateWorkflow`)
- **Hydration** from `WorkflowDetail` API type with automatic node type
  inference and action ordering
- **Dirty tracking** with signature-based change detection
- **Graph serialisation** via `buildUpdateWorkflowRequest()` producing the
  Portarium `UpdateWorkflowRequest` contract

The builder uses `@xyflow/react` (MIT) which provides the canvas, zoom/pan,
minimap, and edge routing. All domain logic is in Portarium code.

### 4. Integration Complexity

| Factor             | n8n Embed                                         | Native                                     |
| ------------------ | ------------------------------------------------- | ------------------------------------------ |
| Bundle size        | ~2-5 MB (full n8n editor + Vue runtime)           | ~150 KB (ReactFlow + custom nodes)         |
| Framework          | Vue 3 (n8n is Vue-based)                          | React (matches cockpit stack)              |
| Auth integration   | Separate session/token model                      | Uses cockpit auth context directly         |
| API contract       | n8n REST API (create/update/execute workflow)     | Portarium OpenAPI contract                 |
| Theming            | n8n design system, limited customisation          | Tailwind + Radix, fully themed             |
| Mobile support     | Not designed for mobile viewports                 | Already responsive (bead-0717)             |
| Accessibility      | n8n has partial WCAG coverage                     | Custom nodes follow cockpit a11y standards |
| Performance budget | Heavy; Vue + n8n runtime loaded on workflow route | Lightweight; only ReactFlow added          |

**Verdict:** Embedding n8n would introduce a Vue runtime inside a React app,
add significant bundle size, require a separate auth bridge, and fight the
existing design system. The integration cost exceeds the cost of continuing
to build on the native editor.

### 5. Feature Gap Analysis

Features n8n has that the native editor lacks:

| Feature                         | Importance for Portarium                                   | Effort to add natively              |
| ------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| 400+ integration nodes          | Low (Portarium uses port/adapter, not direct integrations) | N/A (not needed)                    |
| Execution/debug in editor       | Medium (useful for testing)                                | Medium (wire to run API)            |
| Version history                 | Medium                                                     | Low (API already tracks versions)   |
| Sub-workflows                   | Low for MVP                                                | Medium                              |
| Error handling nodes            | Medium                                                     | Low (add try/catch node type)       |
| Credential management in editor | Low (Portarium manages credentials separately)             | N/A                                 |
| Template library                | Low for MVP                                                | Low (seed templates from API)       |
| Code/expression editor          | Medium                                                     | Medium (add Monaco for expressions) |

None of the n8n features that the native editor lacks are critical for the
Portarium MVP. Most can be added incrementally to the native editor.

## Decision

**Continue with the native ReactFlow-based workflow editor. Do not embed n8n.**

Rationale:

1. **Licensing hard blocker**: n8n's SUL is incompatible with Portarium's
   intended distribution model without a commercial embedding agreement.
2. **Domain misalignment**: Portarium's governance concepts (approval gates,
   execution tiers, evidence chains, port families) have no n8n equivalents.
3. **Existing investment**: The native editor is already functional with 11
   domain-specific components, load/save, validation, and drag-and-drop.
4. **Stack coherence**: Embedding Vue inside React adds framework complexity,
   bundle weight, and theming friction.
5. **Mobile parity**: The native editor works within the cockpit's responsive
   layout; n8n's editor does not support mobile viewports.

## Consequences

### Positive

- Zero licensing risk for any distribution model (MIT everywhere).
- Full control over domain-specific node types and governance semantics.
- Consistent UX within the cockpit design system.
- Smaller bundle size and faster page loads.
- Mobile-responsive workflow editing.

### Negative

- Must build advanced editor features (expression editor, debug mode, version
  diff) incrementally rather than getting them from n8n out of the box.
- No access to n8n's 400+ integration node library (mitigated by Portarium's
  port/adapter architecture which handles integrations at the control plane
  level, not the editor level).

## Future Considerations

- If a commercial n8n Embed agreement is pursued as a separate business decision,
  it would only be for an optional "power user" mode, not replacing the native
  editor.
- The native editor should add expression editing (Monaco) and execution preview
  as next-priority features.
- Consider evaluating BPMN.io (bpmnjs, MIT-licensed) as a complementary
  visualisation layer for compliance/audit views that need BPMN notation.

## References

- ADR-0078: Agentic Workflow Cockpit Reuse vs Build Strategy
- docs/how-to/licensing-gate.md (section 5: Workflow UI component compliance)
- n8n Sustainable Use License: https://docs.n8n.io/sustainable-use-license/
- @xyflow/react (ReactFlow): MIT license
- Existing native editor: apps/cockpit/src/components/cockpit/workflow-builder/
