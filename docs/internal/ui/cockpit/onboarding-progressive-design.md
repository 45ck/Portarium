# UX Design: Onboarding and Progressive Disclosure

**Bead:** bead-0474
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

First-run experience and progressive disclosure reduce the cognitive load of initial setup, guide users to value quickly, and ensure that complexity is revealed only when needed.

---

## 2. First-Run Wizard (5 Steps)

Triggered automatically for workspaces with no configured adapters and no completed runs. Displayed as a full-screen modal overlay with a progress stepper.

### Step Progress Stepper

① Create workspace ② Invite users ③ Add adapter ④ Create workflow ⑤ Run it
✓ ✓ ● ○ ○

- Completed steps show checkmark and are clickable (to go back and review).
- Current step highlighted in primary blue.
- Future steps are grey and not clickable.

### Step 1: Create Workspace

Workspace name input (pre-filled with org name from sign-up if available), Slug (auto-generated, editable), Data residency region selector (EU / US / APAC). [Continue]

### Step 2: Invite Users

Email input with Add another link for multiple invites. Role selector per invitee (Admin / Operator / Viewer). [Send invites and continue] [Skip for now]

### Step 3: Configure First Adapter

Adapter type selector (card grid: Salesforce / Jira / GitHub / Slack / + Browse all). Selecting an adapter shows a contextual connection form. [Connect adapter] [Skip for now]

### Step 4: Create First Workflow

Two paths offered as cards: Use a template (template gallery filtered to connected adapter) or Start from scratch (opens blank workflow builder).

### Step 5: Run It

Preview of the chosen workflow. [Run now] button. Success animation on completion. You are all set! [Go to cockpit dashboard]

### Wizard Persistence

Wizard state is saved server-side per workspace. If user closes mid-wizard, a Continue setup banner appears on the dashboard until the wizard is completed or explicitly dismissed.

---

## 3. Guided Setup - Contextual Tips

Empty states across the cockpit include contextual tips rather than just No data messages.

### Format

Tip: Workflows let you orchestrate actions across your connected adapters. Create one to get started. [Create workflow] [Learn more]

- Tips are dismissible per screen (preference stored in user profile).
- Learn more links open contextual documentation in a side drawer.

### What's Next? Cards

On the dashboard, after each major milestone a What's next? card appears suggesting the next logical action:

| Milestone completed     | What's next? suggestion    |
| ----------------------- | -------------------------- |
| First adapter connected | Create your first workflow |
| First workflow created  | Run the workflow           |
| First run completed     | Review evidence            |
| Evidence reviewed       | Configure a policy rule    |

Cards are dismissible. They do not reappear once dismissed.

---

## 4. Empty State Transitions

### Runs Screen

| State                                   | UI shown                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Empty (no runs ever)                    | Illustration + No runs yet. Create a workflow to run it. + [Create workflow] |
| Partial (runs exist but none completed) | List of in-progress runs + tip card                                          |
| Configured (completed runs exist)       | Full runs table with filters, search, pagination                             |

### Evidence Screen

| State      | UI shown                                                                         |
| ---------- | -------------------------------------------------------------------------------- |
| Empty      | No evidence collected yet. Evidence is created automatically when runs complete. |
| Partial    | Evidence timeline with a More evidence will appear as runs complete footer tip   |
| Configured | Full evidence explorer with search and filter                                    |

---

## 5. Progressive Disclosure

### Basic / Advanced Settings Toggle

In configuration forms: Basic shows name, description, primary action, target adapter. Advanced (hidden by default) shows: retry configuration, timeout, custom headers, expression overrides, debug flags. The toggle remembers the user's preference per form type.

### Show more for Complex Forms

Where a list of optional fields would clutter the form, a [+ Show 4 more channels] link expands all options. A [Show less] link collapses back.

### Inline Help Text

Short help text appears beneath inputs where clarification helps new users. Help text is hidden for users who have interacted with that field type before (tracked via a per-field localStorage flag).

---

## 6. Re-Onboarding Path

### Adapter Breaks

When a previously-healthy adapter enters an error state, the cockpit shows: An amber banner on the dashboard: Adapter Salesforce CRM needs attention. [Fix it]. Clicking Fix it opens a guided repair flow: Step 1: Diagnose (run connectivity test), Step 2: Re-authenticate or update credentials, Step 3: Verify (re-run test).

### Workspace Reset

If an admin resets workspace data (via Settings > Danger zone): A confirmation dialog requires typing RESET and acknowledges that all runs, evidence, and configured adapters will be deleted. After reset, the first-run wizard is re-triggered automatically.

---

## 7. Nielsen Heuristic Review

| Heuristic                                      | Application                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#1 Visibility of system status**             | Progress stepper always shows which step the user is on and how many remain; Continue setup banner on the dashboard reminds users of incomplete setup. |
| **#3 User control and freedom**                | Skip for now on non-critical wizard steps; wizard state is preserved if closed; tip cards are dismissible.                                             |
| **#6 Recognition over recall**                 | Template gallery reduces need to remember workflow syntax; adapter card grid shows recognised brand logos.                                             |
| **#7 Flexibility and efficiency**              | Advanced settings hidden for new users; experienced users can access them immediately.                                                                 |
| **#9 Help users recognise, diagnose, recover** | Re-onboarding flow for adapter failures walks users through diagnosis and repair step-by-step.                                                         |

---

## 8. Accessibility (WCAG 2.2 AA)

- Wizard modal traps focus; Tab cycles through step content; Escape offers a Close wizard? confirmation.
- Progress stepper: role=list with each step as role=listitem; current step has aria-current=step.
- Completed steps: aria-label includes (completed) in the label.
- Skip for now links have aria-label=Skip inviting users for now (not just Skip) to provide context for screen reader users.
- Empty state CTAs: descriptive aria-label on buttons.
- Progressive disclosure toggles: aria-expanded, aria-controls.
- Inline help text: associated with inputs via aria-describedby.
- Confetti animation on step 5 completion: prefers-reduced-motion respected; replaced with a static success icon.
