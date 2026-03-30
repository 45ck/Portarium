# Research: mission-control-ui Domain Model Deep Dive

**Bead:** bead-0965
**Date:** 2026-03-30
**Author:** worker-salesforce
**Feeds:** ADR-0140 (bead-0967)

---

## 1. What is mission-control-ui?

mission-control-ui (MCU) is a standalone React SPA at `C:/Projects/mission-control-ui/` that provides a **mission-centered operating surface** for reviewing, approving, and coordinating agentic software engineering work. It is a separate project from Portarium, built on a `vibe-ts` DDD template.

### Tech stack

| Layer       | Technology                                                          |
| ----------- | ------------------------------------------------------------------- |
| Framework   | React 19 + react-router (createBrowserRouter)                       |
| Build       | Vite                                                                |
| Styling     | Tailwind CSS + custom design tokens (inline styles)                 |
| Animation   | framer-motion                                                       |
| Icons       | lucide-react                                                        |
| Fonts       | Orbitron 500/700, Rajdhani 500/700, IBM Plex Sans Condensed 400/500 |
| Monorepo    | npm workspaces (`packages/shared`, `apps/web`)                      |
| Testing     | Vitest + Playwright (E2E) + Stryker (mutation)                      |
| Lint/Format | ESLint + Prettier + dependency-cruiser + cspell + knip              |
| Quality     | Mutation testing gate (>70% for domain/application layers)          |

### Architecture

MCU follows a four-layer DDD architecture (ADR-001) enforced by dependency-cruiser:

- `domain/` -- entities, value objects (via `packages/shared`)
- `data/` -- typed data modules with fixture data (acts as application/data layer)
- `components/` -- UI components organized by feature area
- `pages/` -- route-level page components

The `packages/shared` package provides foundational domain primitives:

- **Branded types** -- `Brand<T, B>` wrapping pattern (same concept as Portarium's branded primitives)
- **Domain events** -- `DomainEvent<T, P>` with `type`, `occurredAt`, `payload`

---

## 2. Domain Model / Data Structures

### Core Entities

#### Mission (primary aggregate root)

```typescript
interface Mission {
  id: string; // e.g. "MSN-001"
  title: string;
  goal: string; // detailed description of objective
  scopeBoundary: string; // what is/isn't in scope
  risks: string[];
  acceptanceCriteria: string[];
  owner: string; // human operator name
  stage: Stage; // 'plan' | 'execute' | 'review' | 'escalation' | 'completed'
  riskTier: RiskTier; // 'low' | 'medium' | 'high'
  verificationState: VerificationState; // 'pending' | 'passing' | 'failing' | 'blocked'
  agentSessionIds: string[];
  browserSessionIds: string[];
  terminalSessionIds: string[];
  evidenceIds: string[];
  escalationIds: string[];
  createdAt: string;
  updatedAt: string;
  blockedBy?: string[]; // mission dependency graph
  blocks?: string[];
  priority?: Priority; // 'low' | 'medium' | 'high' | 'critical'
  tags?: string[];
  workflowId?: string; // parent workflow
  branch?: string; // git branch
  escalationActive?: boolean; // overlay flag (replacing 'escalation' stage)
  artifactIds?: string[];
}
```

**Key observation:** `Stage` is being refactored -- `'escalation'` as a stage is deprecated in favor of the `escalationActive` boolean overlay flag. This means escalation can happen at ANY stage, not just as a dedicated stage.

#### Workflow (mission grouping)

```typescript
interface Workflow {
  id: string; // e.g. "WF-001"
  title: string;
  description: string;
  missionIds: string[];
  owner: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}
```

#### Evidence (verification artifact)

```typescript
type EvidenceType = 'test-result' | 'policy-check' | 'requirement-trace' | 'risk-explanation';
type EvidenceStatus = 'pass' | 'fail' | 'warning' | 'pending';

interface Evidence {
  id: string;
  missionId: string;
  type: EvidenceType;
  title: string;
  status: EvidenceStatus;
  detail: string;
  source: string; // file path or policy reference
  timestamp: string;
}
```

#### Escalation (human-decision-required)

```typescript
type EscalationType =
  | 'ambiguous-requirement'
  | 'conflicting-evidence'
  | 'security-sensitive'
  | 'scope-breach'
  | 'architectural-friction';

interface Escalation {
  id: string;
  missionId: string;
  type: EscalationType;
  title: string;
  summary: string;
  detail: string;
  options: EscalationOption[]; // structured decision choices with risk annotations
  checkpoint: string; // where in agent execution the escalation was raised
  timestamp: string;
}

interface EscalationOption {
  id: string;
  label: string;
  description: string;
  risk: string; // risk annotation per option
}
```

#### AgentSession (execution context)

```typescript
interface AgentSession {
  id: string;
  missionId: string;
  role: string; // 'Implementation Agent', 'Test Agent', 'Research Agent'
  model: string; // e.g. 'claude-sonnet-4-6', 'claude-opus-4-6'
  status: 'active' | 'paused' | 'completed' | 'failed';
  steps: AgentStep[];
  semanticSummary: string; // human-readable summary of what agent did
  startedAt: string;
  updatedAt: string;
  tokensUsed?: TokenUsage; // { input, output, total }
  estimatedCost?: number;
  toolsUsed?: string[]; // 'file_read', 'file_write', 'terminal', 'browser', 'git'
  branch?: string;
}
```

#### AgentMessage (chat transcript)

```typescript
type AgentMessageRole = 'user' | 'agent' | 'tool-call' | 'tool-result' | 'system' | 'plan-proposal';

interface AgentMessage {
  id: string;
  sessionId: string;
  role: AgentMessageRole;
  content: string;
  toolName?: string;
  toolInput?: string;
  timestamp: string;
  requiresApproval?: boolean; // true for plan-proposal messages that need human approval
}
```

**Key observation:** The `requiresApproval` flag on `plan-proposal` messages is the MCU equivalent of Portarium's `AgentActionProposal`. Both model the "agent proposes, human approves" pattern.

#### Artifact (deliverable output)

```typescript
type ArtifactType = 'image' | 'video' | 'markdown' | 'html';

interface Artifact {
  id: string;
  missionId: string;
  type: ArtifactType;
  title: string;
  content: string; // URL for image/video, inline for markdown/html
  thumbnail?: string;
  createdAt: string;
}
```

#### MissionEvent (audit trail)

```typescript
type MissionEventType =
  | 'created'
  | 'plan-approved'
  | 'execution-started'
  | 'evidence-collected'
  | 'escalation-raised'
  | 'review-approved'
  | 'completed';

interface MissionEvent {
  id: string;
  missionId: string;
  type: MissionEventType;
  actor: string; // human name or agent session ID
  detail: string;
  timestamp: string;
}
```

#### Notification

```typescript
type NotificationType = 'stage-change' | 'escalation' | 'agent-failure' | 'approval' | 'evidence';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  missionId: string;
  read: boolean;
  timestamp: string;
}
```

#### Workspace (deprecated)

```typescript
/** @deprecated -- dissolved in favor of Mission.branch + LiveViewState */
interface Workspace {
  id: string;
  missionId: string;
  branch: string;
  baseBranch: string;
  activeFile: string;
  openFiles: string[];
  terminalSessionId: string;
  browserSessionId?: string;
  agentSessionId: string;
}
```

### Component Hierarchy

```
AppShell
  LeftNav (mission switcher, navigation links)
  TopBar (breadcrumbs, notifications, command palette trigger)
  CommandPalette (Cmd+K)
  NotificationCenter
  MissionSwitcherDropdown

Pages:
  MissionHome (grid of MissionCards)
  MissionCreate
  MissionDetail
    MissionHeader
    MissionTimeline
    StageTabBar (plan/execute/review tabs)
    FocusPanel
    DependencyGraph
    ArtifactPanel
  MissionPlan
  MissionExecute
    AgentSwimlane (multi-agent lanes)
    SessionPane (per-agent step cards)
    StepCard
    AgentChatPanel
    AgentConfigPanel
    LivePreview
  MissionReview
    DecisionBar (approve/reject with evidence)
    ApprovalBar
    DiffByIntent
    RiskBadge
  MissionEscalation
    EscalationHeader
    ConsequencePanel
    ReplayTimeline
  LiveView (code viewer + terminal + browser + chat)
  CostDashboard
  Workflows / WorkflowCreate / WorkflowDetail
  History
  Settings

Evidence components:
  EvidenceRail
  EvidenceCard
  EvidenceDetailModal
  VerificationBadge

Primitives:
  AmbientDots, ConfirmDialog, ConnectionStatusBanner, ConnectorLines,
  CornerBracket, EmptyState, ErrorBoundary, FeedTicks, HeatNode,
  HelpModal, PanelPins, PermissionGate, RuleLabel, ToastContainer

Workspace components:
  BranchBadge, BrowserPreview, CodeViewer, FileTree,
  TerminalEmulator, WorkspaceLayout, WorkspaceTabs
```

### Route Structure

| Route                      | Page              | Purpose                    |
| -------------------------- | ----------------- | -------------------------- |
| `/missions`                | MissionHome       | Mission grid/list          |
| `/missions/new`            | MissionCreate     | Create mission             |
| `/missions/:id`            | MissionDetail     | Mission overview           |
| `/missions/:id/plan`       | MissionPlan       | Plan stage view            |
| `/missions/:id/execute`    | MissionExecute    | Agent execution view       |
| `/missions/:id/review`     | MissionReview     | Evidence review + approval |
| `/missions/:id/escalation` | MissionEscalation | Escalation resolution      |
| `/missions/:id/live`       | LiveView          | IDE-like live coding view  |
| `/workflows`               | Workflows         | Workflow list              |
| `/workflows/:id`           | WorkflowDetail    | Workflow with missions     |
| `/costs`                   | CostDashboard     | Token/cost tracking        |
| `/history`                 | History           | Event audit trail          |
| `/settings`                | Settings          | Configuration              |

---

## 3. Design Tokens

### Color Palette (`aw` tokens)

MCU uses a muted, warm-gray palette named `aw` (likely "aerospace white"):

| Token                                         | Hex                               | Usage                  |
| --------------------------------------------- | --------------------------------- | ---------------------- |
| `shell`                                       | `#d8ddde`                         | App background         |
| `paperTop`                                    | `#f7f8f8`                         | Card top gradient      |
| `paperBottom`                                 | `#eceeef`                         | Card bottom gradient   |
| `haze`                                        | `#eef1f1`                         | Hover states           |
| `map` / `mapSoft`                             | `#dadedf` / `#e5e8e8`             | Map/grid backgrounds   |
| `lineFaint` / `line` / `lineDark` / `lineInk` | `#dcdfdf` through `#8c9396`       | Border hierarchy       |
| `textStrong` / `text` / `textSoft`            | `#5a6266` / `#6e767a` / `#93999c` | Text hierarchy         |
| `plate` / `plateDark`                         | `#63696d` / `#4f5559`             | Dark surface elements  |
| `accent` / `accentStrong` / `accentSoft`      | `#d56f5f` / `#c85f49` / `#ebbab0` | Warm terracotta accent |
| `inverse`                                     | `#f8f8f8`                         | Inverse text           |

### Semantic Colors

| Token                                      | Hex                               | Usage                |
| ------------------------------------------ | --------------------------------- | -------------------- |
| `success` / `successSoft` / `successMuted` | `#5a8a5a` / `#f0f5f0` / `#4a6b4a` | Pass states          |
| `warning` / `warningSoft`                  | `#b8860b` / `#f5f0e0`             | Warning states       |
| `error` / `errorSoft`                      | `#c85f49` / `#f5e8e6`             | Fail/error states    |
| `info` / `infoSoft`                        | `#5a7a8a` / `#e8f0f5`             | Informational states |

### Animation Transitions

| Preset   | Config                      |
| -------- | --------------------------- |
| `fast`   | 120ms easeOut               |
| `normal` | 200ms easeOut               |
| `slow`   | 350ms easeInOut             |
| `spring` | stiffness: 300, damping: 24 |

### Typography

- **Orbitron** (500, 700) -- sci-fi display font for headings, badges, status labels
- **Rajdhani** (500, 700) -- technical condensed font for body text, data displays
- **IBM Plex Sans Condensed** (400, 500) -- utility font for compact UI elements

---

## 4. How Design Tokens Could Be Absorbed into Portarium Cockpit

### Current Cockpit Stack

Portarium cockpit uses: TanStack Router (file-based), TanStack Query, shadcn/ui, Zustand, Tailwind CSS.

### Absorption Strategy

**Option A: Theme Extension (recommended)**

Add MCU tokens as a secondary Tailwind theme in `apps/cockpit/tailwind.config.ts`:

```typescript
// apps/cockpit/tailwind.config.ts
extend: {
  colors: {
    aw: {
      shell: '#d8ddde',
      paper: { top: '#f7f8f8', bottom: '#eceeef' },
      haze: '#eef1f1',
      // ... full aw palette
    }
  },
  fontFamily: {
    'mc-display': ['Orbitron', 'system-ui'],
    'mc-body': ['Rajdhani', 'system-ui'],
    'mc-utility': ['IBM Plex Sans Condensed', 'system-ui'],
  }
}
```

Then add a theme toggle in cockpit settings: "Standard" vs "Mission Control" skin.

**Option B: Component Library**

Extract MCU primitives (CornerBracket, AmbientDots, FeedTicks, HeatNode, PanelPins) into a shared package `@portarium/mission-control-components` that cockpit can import selectively.

**Option C: CSS Custom Properties Bridge**

MCU already uses inline `style={{ color: aw.textStrong }}` extensively. A CSS custom properties layer would allow both apps to share tokens without direct import:

```css
:root[data-theme='mission-control'] {
  --color-aw-shell: #d8ddde;
  --color-aw-accent: #d56f5f;
  /* ... */
}
```

### Recommendation

Use **Option A + B combined**: Tailwind theme extension for colors/typography, plus selective component extraction for the distinctive primitives (CornerBracket, AmbientDots, etc.) that define the MCU aesthetic. Keep it as an opt-in theme toggle so existing cockpit users are not impacted.

---

## 5. What API Surface Would Be Needed?

MCU currently uses static fixture data (`apps/web/src/data/*.ts`). To integrate with Portarium, the following API endpoints would be needed:

### Mission CRUD

| Method | Endpoint                  | Maps to Portarium                   |
| ------ | ------------------------- | ----------------------------------- |
| GET    | `/api/missions`           | List runs (with enriched metadata)  |
| GET    | `/api/missions/:id`       | Get run detail                      |
| POST   | `/api/missions`           | Create run with scope/risk/criteria |
| PATCH  | `/api/missions/:id/stage` | Advance run phase                   |

### Evidence

| Method | Endpoint                     | Maps to Portarium                               |
| ------ | ---------------------------- | ----------------------------------------------- |
| GET    | `/api/missions/:id/evidence` | List evidence entries for a run                 |
| POST   | `/api/missions/:id/evidence` | Record new evidence (test result, policy check) |

### Escalation / Approval

| Method | Endpoint                        | Maps to Portarium                            |
| ------ | ------------------------------- | -------------------------------------------- |
| GET    | `/api/missions/:id/escalations` | List agent action proposals needing decision |
| POST   | `/api/escalations/:id/decide`   | Submit human decision on escalation option   |

### Agent Sessions

| Method    | Endpoint                     | Maps to Portarium                         |
| --------- | ---------------------------- | ----------------------------------------- |
| GET       | `/api/missions/:id/sessions` | List agent sessions (machine invocations) |
| GET       | `/api/sessions/:id/messages` | Get agent chat transcript                 |
| WebSocket | `/ws/sessions/:id`           | Real-time agent activity stream           |

### Artifacts

| Method | Endpoint                      | Maps to Portarium      |
| ------ | ----------------------------- | ---------------------- |
| GET    | `/api/missions/:id/artifacts` | List run artifacts     |
| POST   | `/api/missions/:id/artifacts` | Upload/create artifact |

### Workflows

| Method | Endpoint         | Maps to Portarium        |
| ------ | ---------------- | ------------------------ |
| GET    | `/api/workflows` | List workflow campaigns  |
| POST   | `/api/workflows` | Create workflow grouping |

---

## 6. Domain Model Comparison: MCU vs Portarium

| MCU Concept                           | Portarium Equivalent          | Notes                                                                            |
| ------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Mission                               | Run (WorkflowRun)             | MCU Mission has richer metadata: scope boundary, risks, acceptance criteria      |
| Stage (plan/execute/review/completed) | Run phase                     | MCU stages map roughly to Portarium run lifecycle                                |
| Workflow                              | Campaign (bead campaign)      | Both group related work items                                                    |
| Evidence                              | EvidenceEntry (WORM chain)    | Portarium has immutable evidence with SHA-256; MCU evidence is mutable           |
| Escalation                            | AgentActionProposal           | Both model "agent needs human decision" with structured options                  |
| EscalationOption                      | --                            | Portarium proposals don't have multiple structured options with risk annotations |
| AgentSession                          | MachineInvocation             | MCU tracks tokens, cost, semantic summary; Portarium tracks invocation/result    |
| AgentMessage.requiresApproval         | Approval.status === 'Pending' | Same pattern: block agent until human approves                                   |
| RiskTier                              | --                            | Portarium has no explicit risk classification on runs                            |
| VerificationState                     | --                            | Portarium computes this from evidence chain, not stored separately               |
| Artifact                              | DerivedArtifact               | Portarium has artifact system; MCU artifacts are simpler (inline content)        |
| Notification                          | --                            | Portarium has no notification entity yet                                         |
| MissionEvent                          | DomainEvent (CloudEvent)      | MCU events are simpler; Portarium uses CloudEvents spec                          |
| Branded IDs                           | Branded primitives            | Identical pattern -- both use phantom type branding                              |

### Key Gaps in Portarium

1. **Scope boundary and risk annotations** -- Portarium runs don't carry goal/scope/risk metadata
2. **Structured escalation options** -- Portarium proposals are approve/reject; MCU offers N options with risk-per-option
3. **Token/cost tracking per session** -- Portarium doesn't track LLM token usage or cost
4. **Semantic summaries** -- MCU agent sessions have human-readable summaries of what the agent accomplished
5. **Notifications** -- Portarium has no notification system
6. **Plan-proposal approval flow** -- MCU has a typed `plan-proposal` message role that maps to Portarium's approval loop but is more explicitly represented in the UI

### Key Gaps in MCU

1. **WORM evidence chain** -- MCU evidence is mutable; Portarium's is immutable with SHA-256
2. **Tenant isolation** -- MCU is single-tenant; Portarium has full multi-tenant architecture
3. **Real SoR adapters** -- MCU has no system-of-record integration (Portarium has 18 adapter ports)
4. **Policy engine** -- Portarium's graduated autonomy model (AUTO/ASSISTED/HUMAN-APPROVE) is absent from MCU
5. **Governance** -- Portarium's evidence-based governance (WORM audit trail, retention windows) has no MCU counterpart

---

## 7. Assumptions and Notes

- MCU is at v0.1.0 and still uses static fixture data -- no backend API exists yet
- The `Workspace` entity is deprecated; MCU is moving toward `Mission.branch + LiveViewState` instead
- The `escalation` stage is deprecated in favor of `escalationActive` overlay flag -- this is a design improvement that Portarium should consider adopting (escalation as an orthogonal concern, not a phase)
- MCU's doc system uses `.toon` source files that generate markdown -- different from Portarium's spec system
- The HCI docs in `docs/hci/` include cognitive walkthrough, heuristic evaluation, state model, user journeys, information architecture, and consistency audit -- these are valuable UX research assets
- Fonts (Orbitron, Rajdhani) are loaded via `@fontsource/*` packages -- these would need to be added to cockpit's dependencies if the MCU theme is adopted
