# UX Design: Domain Primitive Components Library

**Bead:** bead-0468
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

Domain primitive components are reusable UI building blocks that directly surface domain concepts: effects, evidence, approvals, run status, and errors, in a consistent, accessible way across the cockpit.

---

## 2. EffectsList

### Purpose

Displays the planned or verified effects of a workflow run: what the system intends to do (or did), with confidence, reversibility, and drift indicators.

### Layout

Effects (4)
▾ Planned effects
✓ Create Salesforce contact Confidence: High Reversible
✓ Enqueue welcome email Confidence: High Reversible
⚠ Update billing record Confidence: Medium Irreversible
✗ Send Slack notification Confidence: Low -

▾ Verified effects (post-run)
✓ Salesforce contact created Verified ✓ Hash match
✓ Welcome email queued Verified ✓ Hash match
⚠ Billing record updated Drift ↑ Value changed after write

### Badges

| Badge              | Token               | Meaning                                     |
| ------------------ | ------------------- | ------------------------------------------- |
| Confidence: High   | --color-success-600 | Model confidence >= 90%                     |
| Confidence: Medium | --color-warning-500 | 60-89%                                      |
| Confidence: Low    | --color-error-500   | < 60%                                       |
| Reversible         | --color-neutral-500 | Effect can be compensated                   |
| Irreversible       | --color-error-600   | No compensation available                   |
| Drift ↑            | --color-warning-600 | Post-write state differs from written value |
| ✓ Hash match       | --color-success-600 | Evidence hash verified                      |

### States

- Loading: skeleton row x 3.
- Empty (planned): No effects planned for this step.
- Empty (verified): Run not yet completed; no verified effects.
- Error: Could not load effects. [Retry]

### Accessibility

- role=list on each section; role=listitem on each effect.
- Confidence badge: aria-label=Confidence: High.
- Drift badge: role=alert so drift is announced when first rendered.
- Expand/collapse button: aria-expanded, aria-controls.

---

## 3. EvidenceTimeline

### Purpose

Vertical chronological timeline of evidence entries for a run, each with a hash-verified integrity indicator.

### Layout

2026-02-18 14:32:01 ● Run started ✓ Verified
2026-02-18 14:32:05 ● Step fetch-data begun ✓ Verified
2026-02-18 14:34:12 ● Approval requested ✓ Verified
2026-02-18 14:40:00 ● Approved by alice ✓ Verified
2026-02-18 14:40:02 ⚠ Evidence hash mismatch ✗ Tampered

- Timeline spine is a vertical line; each entry hangs off a circle node.
- Green circle = verified; red circle with X = tampered/mismatch.
- Clicking an entry expands an inline detail panel showing raw evidence payload, hash, algorithm, and signer.

### Tamper Indicator

When an entry hash does not match the stored hash, the circle node uses --color-error-600 fill with X icon. Entry row background: --color-error-50. A sticky Evidence integrity issue detected banner appears at the top of the timeline.

### Accessibility

- role=list on timeline; role=listitem on each entry.
- Entry expand button: aria-expanded, aria-controls.
- Tamper banner: role=alert.
- Verified icon: aria-label=Hash verified; tamper icon: aria-label=Hash mismatch - possible tampering.

---

## 4. ApprovalForm

### Purpose

Displayed in the PendingApproval state. Presents the SoD evaluation, the applicable policy, a required rationale field, and the decision buttons.

### Layout

Approval required for: provision-prod-db

SoD Evaluation
✓ You did not initiate this workflow
✓ You are in the approver role for this resource
✗ You are also the resource owner (conflict)

Applicable Policy: prod-db-approval-policy
Tier: 2 - Requires: 2 of 3 approvers
Current approvals: 1 of 2 needed

Rationale (required, min 20 chars)

[Approve] [Deny] [Request changes]

- SoD conflicts cause a warning callout: You have a conflict of interest. Your approval may be invalid under the configured policy.
- The Approve button is disabled if SoD evaluation has any fail rows AND the policy does not allow conflicted approvers.
- Rationale field: minimum 20 characters; character counter shown; submit blocked until minimum met.

### Accessibility

- Form uses form with aria-labelledby pointing to the heading.
- SoD rows: role=list; each row aria-label includes the check and result.
- Rationale: label associated with textarea; character count: aria-describedby.
- Approve button: aria-disabled=true with aria-describedby explaining SoD block.

---

## 5. RunStatusChip

### Purpose

Inline compact badge showing the current run status, usable in tables and cards.

### Variants

| Status          | Fill                         | Label             |
| --------------- | ---------------------------- | ----------------- |
| Pending         | neutral-100                  | Pending           |
| Running         | primary-100, animated border | Running           |
| PendingApproval | warning-100                  | Awaiting approval |
| Approved        | success-100                  | Approved          |
| Executing       | primary-100, animated border | Executing         |
| Completed       | success-600 (white text)     | Completed         |
| Failed          | error-600 (white text)       | Failed            |
| Cancelled       | neutral-400 (white text)     | Cancelled         |
| Compensating    | error-100, dashed border     | Compensating      |

- Animated border on Running and Executing; respects prefers-reduced-motion by removing animation.
- Tooltip shows: Phase, ETA (if Running/Executing and ETA known), last updated timestamp.

### Accessibility

- span with aria-label including status and ETA: e.g. aria-label=Status: Running, ETA 2 minutes.

---

## 6. ErrorUX - Problem Details Mapping

### Purpose

Maps RFC 9457 Problem Details responses to actionable, human-readable banners with instance IDs and copy functionality.

### Banner Layout

X Workflow run could not be started
Reason: The target adapter salesforce is not connected.
Suggestion: Check adapter health in the Adapters screen.

     Error ID: urn:portarium:error:abc-123-def   [Copy]
     [Go to Adapters]                    [Dismiss]

### RFC 9457 Field Mapping

| RFC 9457 field | UI element                                        |
| -------------- | ------------------------------------------------- |
| title          | Bold heading line                                 |
| detail         | Reason paragraph                                  |
| instance       | Error ID with copy button                         |
| type URI       | Mapped to Suggestion text via error catalogue     |
| status         | Not shown to user; used internally to select icon |

### Error Catalogue (examples)

| type URI suffix       | Suggestion shown                                     |
| --------------------- | ---------------------------------------------------- |
| adapter/not-connected | Check adapter health in the Adapters screen.         |
| policy/sod-violation  | A separation of duties policy blocked this action.   |
| quota/exceeded        | Your plan quota has been reached. Upgrade your plan. |
| auth/session-expired  | Your session has expired. Please sign in again.      |

### Accessibility

- role=alert on the banner container; announced immediately by screen readers.
- Copy button: aria-live=polite region for Copied! confirmation.
- Action links have descriptive aria-label that include the destination.
