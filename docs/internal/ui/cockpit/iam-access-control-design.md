# UX Design: IAM and Access Control Screens

**Bead:** bead-0464
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The IAM screen provides tenant administrators with a unified surface for managing RBAC roles, user-to-role assignment, per-adapter credentials, OIDC provider configuration, and fine-grained resource-level permissions.

---

## 2. RBAC Role Matrix

A full-page table where columns = Roles (Owner, Admin, Operator, Viewer, Custom) and rows = Permissions grouped by domain area (Workflows, Evidence, Policies, Users, Adapters, Billing).

### Layout

                   Owner  Admin  Operator  Viewer  [+ New role]

Workflows
View runs ✓ ✓ ✓ ✓
Create runs ✓ ✓ ✓ ✗
Cancel runs ✓ ✓ ✗ ✗
Approve steps ✓ ✓ ✓ ✗

- System roles (Owner, Admin, Viewer) have checkboxes disabled (read-only) and show a lock icon on the column header.
- Custom roles have fully editable checkboxes.
- Row groups are collapsible via a disclosure triangle.
- A sticky column header and sticky first column ensure visibility when scrolling large matrices.
- Save changes button appears in a floating action bar when any cell is modified; unsaved changes trigger a discard? confirmation on navigation.

### Bulk Operations

- Select a column header checkbox to toggle all permissions in that role.
- Clone role action in the column header menu creates a new custom role pre-populated with the same permissions.

---

## 3. Credential Management

Per-adapter credential cards appear in a scrollable card grid beneath the role matrix (reachable via tab: Credentials).

### Credential Card

Salesforce CRM
oauth2 - Last rotated 14 d ago
Client ID sf_client_xxxx
Client Secret xxxxxxxxxx (masked)

[Rotate] [Revoke] [Test]

- Masked values shown by default. Eye icon toggles reveal for 30 s then re-masks automatically.
- Rotate opens a slide-over panel with a form for the new credential values and a confirmation checkbox acknowledging downtime risk.
- Revoke shows a confirmation dialog with the adapter name and a warning that active runs using this credential will fail.
- Test sends a connectivity ping and shows a success/failure inline result.
- Cards with credentials expiring within 14 days show a yellow Expiring in X d badge on the card header.
- Cards with expired credentials show a red Expired badge and the Rotate button is highlighted.

---

## 4. OIDC Provider Indicators

On the Users tab, each user row shows an OIDC provider badge:

| Badge           | Provider                   |
| --------------- | -------------------------- |
| Okta (blue)     | Okta OIDC                  |
| Azure AD (blue) | Microsoft Entra / Azure AD |
| Google (blue)   | Google Workspace           |
| Local (grey)    | Username/password, no SSO  |

- Clicking a badge opens a popover with: provider name, subject claim, last sign-in timestamp, MFA status.
- Users with Local accounts show an optional Migrate to SSO action in their row action menu.
- The OIDC Config tab shows the provider configuration form. When no OIDC provider is configured a warning callout appears.

---

## 5. Fine-Grained Authz

A Resource Permissions sub-tab beneath the role matrix provides resource-level overrides.

### Resource Permission Table

| Resource        | Type     | Allow Roles     | Deny Users | Actions       |
| --------------- | -------- | --------------- | ---------- | ------------- |
| workflow:wf_abc | Workflow | Admin, Operator | alice@corp | Edit / Delete |
| policy:pol_xyz  | Policy   | Owner           | -          | Edit / Delete |

- Add override button opens a form: select resource type, resource ID, allow or deny, select roles/users.
- Deny list entries take precedence over role grants; they are displayed with a red X icon in the Allow/Deny column.
- An information callout explains precedence: Deny overrides always take priority over role grants.

---

## 6. Empty and Warning States

### No Users Yet

Empty state with illustration: No users in this workspace. Invite your first team member to get started. [Invite user]

### OIDC Config Missing

Inline warning banner: OIDC is not configured. Users cannot sign in via SSO. [Configure OIDC provider]

### Credential Expiry Upcoming

Yellow badge on the Credentials tab nav item: Credentials (2) indicating 2 credentials expiring within 14 days.

---

## 7. Nielsen Heuristic Review

| Heuristic                                      | Application                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**             | Expiry badges on credentials and nav tab keep administrators aware of time-sensitive security issues.                     |
| **#5 Error prevention**                        | Confirmation dialogs for Revoke; discard warning for unsaved matrix changes; explicit downtime acknowledgement on Rotate. |
| **#6 Recognition over recall**                 | Role matrix shows all permissions at a glance; no need to navigate to each role individually.                             |
| **#7 Flexibility and efficiency**              | Column-level bulk toggle for power users; row group collapse for focused editing.                                         |
| **#9 Help users recognise, diagnose, recover** | Test button on credentials gives immediate feedback; OIDC missing state links directly to configuration.                  |

---

## 8. Accessibility (WCAG 2.2 AA)

- Role matrix uses role=table, role=rowgroup, role=row, role=columnheader, role=rowheader, role=cell for full semantic structure.
- Checkboxes in the matrix have aria-label combining row and column: aria-label=Operator: Create runs.
- Masked credential fields: aria-label=Client Secret, masked; eye button: aria-label=Show Client Secret / Hide Client Secret.
- Credential expiry badge uses role=alert so expiry warnings are announced when the page loads or updates.
- OIDC provider badges have aria-label=OIDC provider: Okta.
- Slide-over panel for credential rotation traps focus within the panel; Escape closes it and returns focus to the triggering Rotate button.
- All icon-only actions (eye, edit, delete) have explicit aria-label.
- Colour contrast: masked text uses --color-neutral-400 on white background; decorative masking characters are aria-hidden.
