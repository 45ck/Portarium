# Port 14: Projects & Work Management — Integration Catalog

## Port Operations

- `listProjects` — Return projects filtered by team, status, or keyword
- `getProject` — Retrieve a single project by canonical ID or external ref
- `createProject` — Create a new project with name, description, team, and default settings
- `listTasks` — Return tasks / issues filtered by project, assignee, status, label, or sprint
- `getTask` — Retrieve a single task / issue by canonical ID or external ref
- `createTask` — Create a new task with title, description, assignee, priority, and parent project
- `updateTask` — Modify task fields (status, priority, assignee, custom fields, description)
- `moveTask` — Move a task between projects, lists, sections, or boards
- `listBoards` — Return boards / views filtered by project or workspace
- `getBoard` — Retrieve a single board with its columns, swimlanes, and configuration
- `listSprints` — Return sprints / cycles filtered by project or board, with date ranges
- `getSprint` — Retrieve a single sprint / cycle including velocity and completion metrics
- `createSprint` — Create a new sprint / cycle with name, start date, and end date
- `listMilestones` — Return milestones / versions filtered by project or release status
- `listTimeEntries` — Return time entries filtered by task, user, or date range
- `createTimeEntry` — Log time against a task with duration, user, date, and billable flag
- `listComments` — Return comments / updates on a task with pagination
- `addComment` — Append a comment or update to a task

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider             | Source                                                           | Adoption | Est. Customers          | API Style                                | Webhooks                                                                 | Key Entities                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------- | -------- | ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jira (Atlassian)** | S1 — full REST API v3 with OpenAPI spec, cloud sandbox instances | A1       | ~250k+ customers        | REST (JSON), OAuth 2.0 (3LO) / API token | Yes — Jira webhooks and Atlassian Connect lifecycle events               | Issue, Project, Board, Sprint, Epic, Component, Version, Status, Priority, IssueType, Workflow, CustomField, Comment, Attachment, Worklog, Filter, Dashboard, Label, User |
| **Asana**            | S1 — REST API with full docs, developer sandbox workspaces       | A1       | ~130k+ paying customers | REST (JSON), OAuth 2.0 / PAT             | Yes — webhook subscriptions per resource with X-Hook-Secret verification | Task, Project, Section, Tag, CustomField, Workspace, Team, User, Portfolio, Goal, StatusUpdate, Attachment, Comment (Story), Timeline, Rule                               |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider               | Source                                                      | Adoption | Est. Customers                 | API Style                                           | Webhooks                                                                 | Key Entities                                                                                                      |
| ---------------------- | ----------------------------------------------------------- | -------- | ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Monday.com**         | S1 — GraphQL API (API v2) with playground, sandbox accounts | A2       | ~225k+ customers               | GraphQL, OAuth 2.0                                  | Yes — webhook subscriptions on board/item events                         | Board, Item, Column, Group, Workspace, User, Update, Tag, Team, File, Automation, Dashboard, View                 |
| **Linear**             | S1 — GraphQL API with full introspection, OAuth 2.0         | A2       | ~10k+ companies (fast-growing) | GraphQL, OAuth 2.0                                  | Yes — webhook subscriptions with HMAC signing                            | Issue, Project, Team, Cycle, Label, User, Workflow, Milestone, Roadmap, View, Comment, Reaction, Attachment       |
| **ClickUp**            | S1 — REST API v2 with comprehensive docs, free tier         | A2       | ~800k+ teams                   | REST (JSON), OAuth 2.0 / API token                  | Yes — webhook subscriptions on workspace events                          | Task, List, Folder, Space, Workspace, Goal, TimeEntry, Comment, Checklist, Tag, CustomField, View, Doc, Dashboard |
| **Trello (Atlassian)** | S1 — REST API with full docs, free tier sandbox boards      | A2       | ~50M+ registered users         | REST (JSON), OAuth 1.0a / API key + token           | Yes — webhooks on model changes (board, list, card)                      | Board, List, Card, Checklist, CheckItem, Member, Label, Attachment, Action, CustomField, PowerUp, Plugin          |
| **Notion**             | S1 — REST API with versioned endpoints, integration tokens  | A2       | ~30M+ users                    | REST (JSON), OAuth 2.0 / Internal integration token | Limited — no native webhooks; polling or third-party connectors required | Page, Database, Block, User, Comment, Property, File, Workspace                                                   |

### Best OSS for Domain Extraction

| Project         | Source                                                  | API Style                            | Key Entities                                                                                          | Notes                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Taiga**       | S1 — self-hosted, full REST API with comprehensive docs | REST (JSON), token auth              | Project, UserStory, Task, Issue, Sprint, Epic, Milestone, Wiki, Attachment, Comment, CustomAttribute  | Agile PM tool supporting Scrum and Kanban. Clean entity model with clear separation of UserStory, Task, and Issue. Good reference for sprint-based workflow normalisation. ~5k GitHub stars.                                  |
| **OpenProject** | S1 — self-hosted, REST API v3 (HAL+JSON) with full docs | REST (HAL+JSON), OAuth 2.0 / API key | WorkPackage, Project, Type, Status, Priority, Version, TimeEntry, Activity, Wiki, Budget, CustomField | Enterprise-grade PM with Gantt charts, budgeting, and time tracking. WorkPackage is the universal work item (maps to tasks, bugs, features). Strong time tracking and resource management entities. ~10k GitHub stars.        |
| **Plane**       | S1 — self-hosted, REST API, rapidly evolving            | REST (JSON), API key                 | Issue, Project, Cycle, Module, Label, State, View, Page, Workspace, Member                            | Modern Jira alternative with clean API design. Issue-centric model with Cycles (sprints) and Modules (epics/features). Fast-growing OSS project (~30k GitHub stars). Good reference for minimal yet complete PM entity model. |

### Tier A3 — Established Niche

| Provider       | Source                                                  | Adoption | Notes                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Basecamp**   | S2 — REST API with limited rate limits, no OpenAPI spec | A3       | Opinionated project management + team communication. ~3.5M+ accounts. Entities: Project, Todolist, Todo, Message, Comment, Schedule, Event, Document, Upload, Person, Campfire (chat). API lacks some advanced filtering; pagination via Link headers.                 |
| **Wrike**      | S1 — REST API v4 with OAuth 2.0, sandbox accounts       | A3       | Enterprise work management with ~20k+ customers. Entities: Task, Folder, Project, Space, CustomField, Workflow, Approval, TimeEntry, Comment, Attachment, User, Group, Contact. Strong in cross-functional enterprise teams.                                           |
| **Smartsheet** | S1 — REST API with OAuth 2.0, developer sandbox         | A3       | Spreadsheet-based project management with ~100k+ customers. Entities: Sheet, Row, Column, Cell, Workspace, Folder, Report, Dashboard, Attachment, Discussion, Comment, User, Group, Automation. Unique sheet-row-cell model requires careful mapping to task paradigm. |

### Tier A4 — Emerging / Regional

| Provider                    | Source                                           | Adoption | Notes                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teamwork**                | S1 — REST API with comprehensive docs, free tier | A4       | Agency and professional services PM with ~25k+ customers. Entities: Project, Task, Tasklist, Milestone, TimeEntry, Comment, File, Person, Company, Tag, Board, Notebook, Risk, Invoice. Strong time tracking and client billing features.     |
| **Shortcut (ex-Clubhouse)** | S1 — REST API v3 with full docs, free tier       | A4       | Developer-focused PM with modern API. Entities: Story, Epic, Iteration, Label, Workflow, Project, Milestone, Member, Comment, File, LinkedFile, Team, Objective. Clean REST API with good filtering and search. Growing in engineering teams. |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by work management domain.

### Core Work Items

- **Task / Issue / WorkItem / Card / Item / Story** — The fundamental unit of work (Task in Asana/ClickUp/Taiga, Issue in Jira/Linear/Plane, Card in Trello, Item in Monday.com, WorkPackage in OpenProject, Story in Shortcut, UserStory in Taiga, Todo in Basecamp, Row in Smartsheet)
- **Project / Board / Space** — A container for related work items (Project in most providers, Board in Jira/Monday.com/Trello, Space in ClickUp, Sheet in Smartsheet)
- **List / Section / Column / Group** — A subdivision within a project or board for organising work items (List in Trello/ClickUp, Section in Asana, Column in Monday.com, Group in Monday.com, Folder in ClickUp/Wrike)

### Planning & Iteration

- **Sprint / Cycle / Iteration** — A time-boxed period for completing a set of work items (Sprint in Jira/Taiga, Cycle in Linear/Plane, Iteration in Shortcut)
- **Epic / Initiative / Module** — A large body of work spanning multiple tasks or sprints (Epic in Jira/Taiga/Linear/Shortcut, Initiative in some tools, Module in Plane, Portfolio in Asana)
- **Milestone / Version / Release** — A target date or release marker for tracking progress (Milestone in Linear/Taiga/Shortcut/Teamwork, Version in Jira/OpenProject, Release in some tools)
- **Goal / Objective** — A high-level outcome that work items contribute to (Goal in Asana/ClickUp, Objective in Shortcut)
- **Roadmap** — A visual timeline of planned work across milestones and projects (Roadmap in Linear, Timeline in Asana)

### Metadata & Classification

- **Label / Tag** — A classification applied to work items for filtering and grouping (Label in Jira/Linear/Plane/Trello, Tag in Asana/ClickUp/Monday.com)
- **CustomField / Property / Column** — A tenant-defined field extending the work item schema (CustomField in Jira/Asana/ClickUp/Trello/OpenProject, Property in Notion, Column in Monday.com/Smartsheet)
- **Priority** — Urgency level assigned to a work item (Priority in Jira/OpenProject, typically enum: critical/high/medium/low/none)
- **Status / State** — Current lifecycle position of a work item (Status in Jira/Asana/Monday.com, State in Plane/Linear, typically: backlog/todo/in-progress/done)
- **Workflow** — A defined sequence of states and transitions for work items (Workflow in Jira/Linear/Wrike, Rule in Asana)
- **IssueType / Type** — The category of work item (bug, feature, task, subtask) within a project (IssueType in Jira, Type in OpenProject)

### Collaboration & Tracking

- **Comment / Update / Story** — A note or discussion entry on a work item (Comment in Jira/Linear/ClickUp/Notion, Update in Monday.com, Story in Asana, Discussion in Smartsheet)
- **Attachment / File** — A document or media file linked to a work item (Attachment in most providers, File in Monday.com/ClickUp/Plane)
- **TimeEntry / Worklog** — A record of time spent on a work item (Worklog in Jira, TimeEntry in ClickUp/OpenProject/Wrike/Teamwork)
- **Checklist / CheckItem** — A sub-list of checkable items within a work item (Checklist in Trello/ClickUp, CheckItem in Trello)

### Containers & Access

- **Workspace / Organization** — The top-level tenant or account container (Workspace in Asana/ClickUp/Monday.com/Notion/Plane, Organization in some providers)
- **Team** — A group of users collaborating on projects (Team in Asana/Linear/Monday.com/Trello, Group in Wrike)
- **User / Member / Assignee** — A person within the system who can be assigned work (User in most providers, Member in Trello/Plane, Assignee in task context, Person in Basecamp/Teamwork)

### Documentation & Views

- **View / Filter / Dashboard** — A saved query, board view, or reporting dashboard (View in Linear/ClickUp/Plane/Monday.com, Filter in Jira, Dashboard in Jira/ClickUp/Monday.com/Smartsheet)
- **Doc / Wiki / Page** — A document or knowledge page within the PM tool (Doc in ClickUp, Wiki in Taiga/OpenProject, Page in Notion/Plane, Notebook in Teamwork)

---

## VAOP Canonical Mapping

| Universal Entity               | VAOP Canonical Object      | Mapping Notes                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task / Issue / WorkItem / Card | `Task`                     | Direct mapping to VAOP Task. Title, description, status, priority, and assignee normalised. Provider-specific statuses mapped to a canonical lifecycle enum (backlog, todo, in_progress, done, cancelled). Custom fields preserved as structured metadata. |
| Project / Board / Space        | `ExternalObjectRef`        | Project containers vary significantly in structure (hierarchical vs. flat, board-centric vs. list-centric). Stored as typed external references with project metadata (key, lead, dates). Tasks link to their parent project ref.                          |
| Sprint / Cycle / Iteration     | `ExternalObjectRef`        | Time-boxed iterations with start/end dates, velocity, and completion metrics. Stored as external references with date range and goal metadata. Tasks link to their sprint ref.                                                                             |
| Epic / Initiative / Module     | `ExternalObjectRef`        | Large work groupings spanning sprints. Stored as external references with hierarchy metadata (epic → task). Progress metrics (% complete, child count) stored as metadata.                                                                                 |
| Label / Tag                    | `ExternalObjectRef`        | Classification labels applied to tasks via many-to-many relationships. Stored as external references with colour and description metadata.                                                                                                                 |
| Comment / Update / Story       | `ExternalObjectRef`        | Task-scoped discussion entries with variable structure (plain text, rich text, mentions). Stored as external references linked to parent Task. Author and timestamp preserved.                                                                             |
| Attachment / File              | `Document`                 | Direct mapping. File metadata (name, size, MIME type) normalised. Binary content referenced by provider URL or VAOP storage key. Linked to parent Task.                                                                                                    |
| User / Member / Assignee       | `Party` (role: `employee`) | Mapped to Party with employee role. Display name, email, and avatar normalised. Assignment relationships link Party to Task.                                                                                                                               |
| TimeEntry / Worklog            | `ExternalObjectRef`        | Time records with duration, user, date, and billable flag. Stored as external references linked to both parent Task and the logging Party.                                                                                                                 |
| Goal / Objective               | `ExternalObjectRef`        | High-level outcomes that tasks contribute to. Stored as external references with progress metrics and target dates.                                                                                                                                        |
| Version / Release              | `ExternalObjectRef`        | Release markers with target dates and status (unreleased, released, archived). Stored as external references linked to the parent project.                                                                                                                 |
| Milestone                      | `ExternalObjectRef`        | Target date markers for tracking progress. Stored as external references with due date and linked tasks/epics.                                                                                                                                             |
| Workspace / Organization       | `ExternalObjectRef`        | Top-level tenant containers. Stored as external references; all child entities link upward via hierarchy metadata.                                                                                                                                         |
| Team                           | `ExternalObjectRef`        | User groupings for project access and task assignment. Stored as external references with membership metadata.                                                                                                                                             |
| Priority                       | `ExternalObjectRef`        | Priority levels vary across providers. Stored as external references mapped to a normalised ordinal for cross-system comparison.                                                                                                                           |
| Status / State                 | `ExternalObjectRef`        | Lifecycle states for work items. Stored as external references mapped to a normalised status enum on the Task canonical.                                                                                                                                   |
| Workflow                       | `ExternalObjectRef`        | State machine definitions. Stored as external references for audit; VAOP does not execute provider workflows cross-platform.                                                                                                                               |
| CustomField / Property         | `ExternalObjectRef`        | Tenant-defined schema extensions. Stored as typed external references preserving field name, data type, and allowed values.                                                                                                                                |
| View / Filter / Dashboard      | `ExternalObjectRef`        | Saved queries and visual layouts. Stored as external references for workspace configuration sync.                                                                                                                                                          |
| Wiki / Page / Doc              | `Document`                 | In-tool documentation mapped to Document. Rich text content, hierarchy (parent-child pages), and embedded media preserved.                                                                                                                                 |
| Checklist                      | `ExternalObjectRef`        | Sub-task checklists within a work item. Stored as external references linked to parent Task with item completion states.                                                                                                                                   |

---

## Notes

- **Jira** and **Asana** together represent the core of the enterprise PM market and should be the first two adapters implemented for Port 14. Jira's Issue model is the de facto standard that most other tools map against.
- **Monday.com** and **Linear** use GraphQL APIs, which require a different adapter pattern than REST-based providers. Consider a shared GraphQL adapter base for these two.
- **Trello** and **Notion** bridge the gap between structured PM and flexible workspace tools. Trello's Card→List→Board hierarchy and Notion's Page→Database→Block model each require specialised normalisation logic.
- The `Task` canonical is the primary entity for Port 14, deliberately unifying issues, cards, stories, items, work packages, and todos under a single type. A `task_type` discriminator (bug, feature, story, subtask, etc.) preserves the original classification.
- Time tracking entities (`TimeEntry` / `Worklog`) are important for billing and resource management use cases. They link to both the parent Task and the logging user (Party), enabling cross-provider time aggregation.
- Sprint/Cycle entities are kept as `ExternalObjectRef` because iteration structures and velocity calculations are deeply provider-specific. The canonical Task carries a sprint reference for grouping purposes.
