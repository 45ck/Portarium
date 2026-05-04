# OpenCode -- Inspiration Review

## Summary

OpenCode (sst/opencode, MIT) is a provider-agnostic terminal coding agent built
by the SST team. It runs as a long-lived headless agent server with multiple
clients (a Solid.js + OpenTUI terminal UI, a Bun CLI, a Tauri desktop app, and
JSON-RPC over stdio via the Agent Client Protocol), all talking to the same
HTTP/WebSocket surface. Three pieces are directly relevant to Portarium's
`AgentRuntimePort` and approval gates: (1) a clean **agent profile model** with
`build` / `plan` / subagent variants, each carrying its own permission ruleset;
(2) a **permission engine** with deny/allow/ask actions, wildcard patterns,
session-scoped and persistent approvals, and a `permission.asked` event bus
that's the natural integration point for Portarium's approval surface; and
(3) an **AI SDK-based provider abstraction** that lazy-loads ~25 providers and
lets plugins inject custom auth/models. The plan -> build mode handoff is
explicit (a `plan_exit` tool that asks the user a question and synthesizes a
build-agent message), which is exactly the seam Portarium wants to govern.

## Repo identity

- URL: https://github.com/sst/opencode
- Commit SHA at clone: `7bc26dafae09d326a0f66d2b69b379bc19b3b26e`
- License: **MIT** (Copyright (c) 2025 opencode). Plain English: do anything,
  including vendor verbatim, as long as the copyright notice and license text
  travel with substantial portions. No patent grant, no copyleft. No
  field-of-use restrictions. **Direct vendoring is permissible** with
  attribution; preferred path is concept reuse plus selective vendor.
- Last commit date at HEAD: 2026-05-03 (Kit Langton)
- Stars: not observed (clone via shallow git, no API call). Project is widely
  referenced; see `opencode.ai`, npm `opencode-ai`, brew `anomalyco/tap/opencode`.
- Primary language(s): TypeScript (Bun runtime), with Tauri/Rust desktop
  shell. Earlier OpenCode releases used a Go TUI (`pkg.go.dev/github.com/sst/opencode`);
  the current `dev` HEAD has migrated the TUI to Solid.js + `@opentui/solid`
  inside the Bun process.
- Client/server split: **yes**. `opencode serve` starts a headless HTTP server
  (Hono + experimental Effect HttpApi backend); the TUI, ACP bridge, and
  desktop shells are clients over HTTP/WebSocket. The same server backs the
  generated SDKs in `packages/sdk/js`.

## Architecture

### Entry points

- `packages/opencode` -- the engine and CLI. Subcommands include `serve`,
  `tui`, `run`, `acp`, `agent`, `mcp`, `models`, `providers`, `plug`, `web`,
  `github` (CI integration). The CLI uses Effect's runtime to wire layered
  services (`Agent.Service`, `Permission.Service`, `Provider.Service`,
  `Session.Service`, `Plugin.Service`, `Skill.Service`, `Bus.Service`,
  `Database`).
- `packages/plugin` -- typed plugin SDK consumed by author packages.
- `packages/sdk/js` -- generated TypeScript client for the HTTP server (built
  with `@hey-api/openapi-ts`, mirrors the OpenAPI spec the server exports).
- `packages/desktop` (Tauri) and `packages/desktop-electron` (Electron) wrap
  the TUI/web client.
- `packages/console`, `packages/web`, `packages/identity`, `packages/slack`,
  `packages/enterprise` -- hosted control plane and ancillary surfaces (SST
  infra in `sst.config.ts`).

### Client/server split

`packages/opencode/src/server/server.ts` defines the surface. There are two
backends behind a feature switch (`ServerBackend.select()`):

1. **Hono backend** (legacy stable). Routes mounted at `/global`, `/control`,
   `/experimental/workspace`, `/instance`. Middleware stack: `AuthMiddleware`,
   `LoggerMiddleware`, `CompressionMiddleware`, `CorsMiddleware`,
   `WorkspaceRouterMiddleware`, `InstanceMiddleware`, `FenceMiddleware`.
2. **Effect HttpApi backend** (`PublicApi` in `routes/instance/httpapi/public`)
   -- canonical schema source for OpenAPI emission and the SDK build.

The server is workspace-aware: an `x-opencode-directory` header (or a
`OPENCODE_WORKSPACE_ID` flag) selects the project context per request, so one
server can host many workspaces. mDNS publication is built in
(`server/mdns.ts`) for LAN discovery. Auth is bearer via
`OPENCODE_SERVER_PASSWORD`. WebSocket upgrades are first-class (PTY connect,
workspace-routing proxy bridge), which is why the Effect HttpApi backend
exists at all.

### Provider abstraction

`packages/opencode/src/provider/provider.ts` (1758 lines, the largest single
file) wraps the [Vercel **AI SDK**](https://sdk.vercel.ai/) (`ai` + `@ai-sdk/*`).
Key design:

- `BUNDLED_PROVIDERS` is a `Record<string, () => Promise<factory>>` that
  lazy-imports SDK packages: `@ai-sdk/anthropic`, `@ai-sdk/openai`,
  `@ai-sdk/google`, `@ai-sdk/google-vertex`, `@ai-sdk/amazon-bedrock`,
  `@ai-sdk/azure`, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`,
  `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/deepinfra`,
  `@ai-sdk/cerebras`, `@ai-sdk/cohere`, `@ai-sdk/gateway`,
  `@ai-sdk/togetherai`, `@ai-sdk/perplexity`, `@ai-sdk/vercel`,
  `@ai-sdk/alibaba`, `gitlab-ai-provider`, `@ai-sdk/github-copilot`
  (custom OpenAI-compatible adapter in `provider/sdk/copilot/`),
  `venice-ai-sdk-provider`. Adding a provider = adding a key to that record.
- Models metadata pulled from `models.dev` (`packages/opencode/src/provider/models.ts`);
  custom models can be injected by the `provider` plugin hook.
- Auth is a separate service (`auth/`) with per-provider strategies (env, OAuth,
  managed) and is consulted by both the agent and the SSE wrapper.
- The provider returns `LanguageModelV3` from `@ai-sdk/provider`, which is
  the universal interface the rest of the agent consumes. **This is the AI-SDK
  shape, not OpenCode-original**, but OpenCode's consumption pattern (lazy
  load, plugin-extensible registry, auth service decoupled from model service)
  is what's worth borrowing.

### Plan vs build modes

These are **agent profiles**, not runtime modes (file:
`packages/opencode/src/agent/agent.ts`). The `Agent.Info` schema:

```ts
{ name, description, mode: "subagent"|"primary"|"all",
  permission: Permission.Ruleset, model?, prompt?, options, ... }
```

Built-in agents:

- `build`: full access (`*: allow`), `plan_enter: allow` (can enter plan mode).
- `plan`: edits denied except for `.opencode/plans/*.md`; `plan_exit: allow`;
  `external_directory` only for the plans dir.
- `general`: subagent for parallel multi-step work.
- `explore`: subagent restricted to read/grep/glob/list/bash/webfetch only.
- `compaction`, `title`, `summary`: hidden internal agents with `*: deny`
  except their specific output need.

Mode switching in the TUI is `Tab` / `Shift+Tab` (`agent_cycle` keybind in
`config/keybinds.ts`). User-defined agents merge over the defaults via config.

The plan -> build handoff is an explicit tool: `tool/plan.ts`'s `plan_exit`
calls `Question.Service.ask`, and on "Yes" synthesizes a `MessageV2.User`
addressed to the `build` agent saying "the plan at <path> has been approved,
you can now edit files". **This is precisely where Portarium would insert an
approval gate**: the question is already a halt point, the synthesized "build"
message is the resumption signal, and the plan path is durable evidence.

### Tool / function-call surface

`packages/opencode/src/tool/`:

- `read`, `write`, `edit`, `apply_patch`, `glob`, `grep`, `list`, `lsp`,
  `webfetch`, `websearch`, `task`, `todo`, `todowrite`, `question`, `skill`,
  `plan_enter`, `plan_exit`, `external_directory`, `mcp-exa`, `shell` (Bash).
- `tool/tool.ts` defines the base `Def` interface: `id`, `description`,
  `parameters` (Effect Schema), `execute(args, ctx) -> Effect<ExecuteResult>`.
  `ctx` provides `sessionID`, `messageID`, `agent`, `abort`, `messages`,
  `metadata()`, and crucially **`ask(input)`** which goes through
  `Permission.Service`.
- `tool/registry.ts` aggregates tools and applies plugin `tool.definition` /
  `tool.execute.before` / `tool.execute.after` / `permission.ask` hooks.
- The `shell` tool parses the bash command tree-sitter style to attribute
  per-binary patterns (e.g. `rm /etc/*`) so the permission system can grant
  or refuse fine-grained Bash invocations -- not the whole shell at once.

### Permissions

`packages/opencode/src/permission/index.ts`:

- `Action = "allow" | "deny" | "ask"`.
- `Rule = { permission: string, pattern: string, action: Action }`.
- `Ruleset = Rule[]`. Resolution is wildcard match per-rule (`util/wildcard`).
- `ask(input)` evaluates patterns; on `ask` it creates a `Deferred`, publishes
  a `permission.asked` bus event, and parks the agent until reply.
- Reply scopes: `"once"`, `"always"` (pushed to project-wide approved
  ruleset, persisted in `PermissionTable`), or `"reject"` (rejects the
  pending request _and_ every other pending request in the same session).
- `RejectedError` and `CorrectedError` are domain errors the agent receives.
- Default ruleset bakes in safe-by-default `.env` reads ("ask"), denies
  unsafe directories outside the worktree, and denies `question` /
  `plan_enter` / `plan_exit` for sub-agents that shouldn't escalate.

### Persistence and bus

- SQLite via Drizzle (`packages/opencode/src/storage/db.ts`,
  `session.sql.ts`). `PermissionTable` stores persistent approvals per project.
- `Bus` service publishes typed `BusEvent`s for permissions, sessions,
  worktrees, and TUI sync. The TUI subscribes via the `EventSource` provided
  to `SDKProvider`. **Externally observable bus events are the natural
  evidence stream for Portarium's `ArtifactCollector`.**

### Worktree & sandbox

`packages/opencode/src/worktree/index.ts` is opinionated: it creates a real
`git worktree` rooted under `Global.Path` per session/branch, with a
`Worktree.Event.Ready` / `Failed` bus event. It assumes the project is a git
repo. There is **no container or VM provider**; everything runs against the
host filesystem. `packages/containers/` only holds CI build images, not
runtime sandboxes.

## UX surfaces (TUI)

The TUI lives at `packages/opencode/src/cli/cmd/tui/` and is rendered with
Solid.js into [`@opentui/solid`](https://github.com/sst/opentui) (a
GPU-accelerated terminal renderer authored by the same team). Notable files:

- `app.tsx` (914 lines): root component. Wraps `RouteProvider`,
  `SDKProvider`, `SyncProvider`, `LocalProvider`, `KeybindProvider`,
  `ThemeProvider`, `DialogProvider`, `CommandProvider`,
  `PromptHistoryProvider`, `FrecencyProvider`, `PromptStashProvider`,
  `TuiPluginRuntime`. Mouse + Kitty keyboard supported. mDNS-friendly.
- `routes/home.tsx`, `routes/session.tsx` -- two-route TUI.
- `component/dialog-*.tsx` -- modal palette for agent (`<leader>a`),
  command (`ctrl+p`), model (`<leader>m`), provider, MCP, status, theme,
  session list / rename / delete, workspace, skill, stash, variant. Also
  `dialog-go-upsell.tsx` (paid-tier prompt -- a thing to **avoid** vendoring).
- `component/prompt/` -- prompt textarea with history, frecency, stash.
- `config/keybinds.ts` -- ~150 named keybinds; default leader is `ctrl+x`.
  Notable: `agent_cycle = tab`, `agent_list = <leader>a`,
  `session_compact = <leader>c`, `session_interrupt = escape`,
  `model_list = <leader>m`, `command_list = ctrl+p`,
  `session_share = none` (opt-in), `session_export = <leader>x`. Override
  per-keybind in `tui.json`.
- `config/tui-schema.ts` -- separate `tui.json` schema for theme, keybinds,
  TUI plugins, scroll behaviour, mouse toggle, diff style.
- Transcript rendering is component-based; `messages_toggle_conceal` hides
  code blocks; `tool_details` toggles per-call detail view; `messages_copy`
  yanks message text.

### Status / mode indicator

The active agent is shown in the status row; `Tab` cycles. There is no
separate "policy tier" badge; that is the gap Portarium fills. The `plan`
agent's denied edits surface as inline `PermissionDeniedError` in the
transcript; the `plan_exit` confirmation is a full-screen dialog via
`Question.Service`.

## Hooks / extension points

Two plugin runtimes exist: **server plugins** and **TUI plugins** (since
v1, a single npm package can ship both, but a single module file is
target-exclusive).

### Server plugin contract (`packages/plugin/src/index.ts`)

```ts
export type Plugin = (input: PluginInput, options?) => Promise<Hooks>;
```

`PluginInput` provides `client` (the SDK), `project`, `directory`, `worktree`,
`serverUrl`, `$` (a Bun shell), and `experimental_workspace.register(type, adapter)`.

`Hooks` -- the integration surface Portarium would mirror almost 1:1:

- `event(input)` -- fires for every bus event.
- `config(input)` -- mutate config at load time.
- `tool: { [id]: ToolDefinition }` -- register or override tools.
- `auth: AuthHook` -- per-provider auth methods (oauth/api), prompt schemas,
  `authorize(inputs)` callbacks. Supports `code` + `auto` OAuth flows.
- `provider: ProviderHook` -- inject `models()` for a provider.
- `chat.message`, `chat.params`, `chat.headers` -- inspect/modify each turn
  and the LLM call params.
- **`permission.ask(input, output: { status: "ask"|"deny"|"allow" })`** --
  policy hook; this is where Portarium's `EngineeringRuntimePolicyV1` plugs
  in to upgrade `ask` -> `deny` or to require evidence.
- `command.execute.before`, `tool.execute.before`, `tool.execute.after`,
  `tool.definition` -- pre/post hooks with mutable args/output.
- `shell.env` -- inject env per shell invocation (cwd-scoped).
- `experimental.chat.messages.transform`, `experimental.chat.system.transform`,
  `experimental.session.compacting`, `experimental.compaction.autocontinue`,
  `experimental.text.complete`.
- **`experimental_workspace.register("type", WorkspaceAdapter)`** -- the
  one extension point that comes closest to Portarium's `SandboxProviderPort`:
  `configure / create / remove / target` (where `target` is `local{directory}`
  or `remote{url, headers}`). This is exactly the abstraction Portarium needs
  to widen for VM / container / remote modes.

### TUI plugin contract (`packages/plugin/src/tui.ts`, `specs/tui-plugins.md`)

JSX-in-terminal via `@opentui/solid`. Plugins can register routes
(`api.route.register`), commands (`api.command.register`), keybinds, status
items, and dialogs. `tui.json` lists plugins by spec; `plugin_enabled` map
toggles them at runtime via KV. Internal opencode features
(`feature-plugins/*`) load through the same machinery.

### Loader pipeline

`plugin/loader.ts` resolves config -> install if npm -> verify entry kind
(`server` vs `tui`) -> compatibility check (`opencode` semver range in
`package.json`) -> dynamic import -> hand to runtime. File plugins are
re-tried after a `wait()` callback to support local dev where deps are
prepared concurrently.

### Agent Client Protocol (ACP)

`packages/opencode/src/acp/` implements the
[Agent Client Protocol](https://agentclientprotocol.com/) v1 over JSON-RPC
on stdio. `opencode acp` is invoked by external clients (Zed is the named
example). The README explicitly says:

- ACP excludes `QuestionTool` by default (gated behind
  `OPENCODE_ENABLE_QUESTION_TOOL=1`).
- Permission requests "auto-approve for now" -- a placeholder.
- Terminal support is a stub.

This is **the standardised wire protocol Portarium should aim to speak** so
that any ACP-aware client (Zed, future VS Code, third-party agents) can drive
a Portarium-governed agent behind the same socket. The current OpenCode ACP
implementation does not yet stream tool calls or surface permission requests
to the client; a Portarium-grade ACP server would fix both.

## What to COPY OUTRIGHT

(MIT permits all of these with attribution. Default rule: take concept, not
code, unless the file is small and self-contained.)

- **`Permission` schema** (`Action`, `Rule`, `Ruleset`, `RejectedError`,
  `CorrectedError`, `DeniedError`, the `Reply = "once"|"always"|"reject"`
  enum). It is small (~50 lines for the types), Effect-Schema-based, and
  almost identical to what Portarium needs. Vendor with attribution into
  `src/domain/governance/` and rename to Portarium's branded primitives.
- **Keybind catalogue** (`config/keybinds.ts`). The default keymap covers
  every interaction Portarium wants in its agent runtime panel; copying the
  schema (not the implementation) gives users muscle-memory parity.
- **`AgentInfo` permission-merge defaults** (the `defaults` block in
  `agent/agent.ts` lines 90-107): the `read` rule that asks before opening
  `.env` files, and the `external_directory` allow-listing pattern, are
  good safe-by-default starting points.

License gate: prepend `// Portions adapted from sst/opencode (MIT,
Copyright (c) 2025 opencode)` at the top of any vendored file and add the
upstream notice to `THIRD_PARTY_NOTICES.md`.

## What to TAKE INSPIRATION FROM

- **AI SDK as the provider abstraction.** Portarium's `AgentRuntimePort`
  should not invent a model interface -- it should consume `LanguageModelV3`
  from `@ai-sdk/provider` and let runtimes (OpenCode, Codex, custom)
  register themselves. The `BUNDLED_PROVIDERS` lazy-import map is the right
  shape for Portarium's provider catalogue.
- **Agent profile = name + permission ruleset + optional model + prompt.**
  This is the right shape for Portarium's runtime profiles. Map directly to
  `EngineeringRuntimePolicyV1` resolutions: each policy outcome materializes
  an agent profile that the runtime executes.
- **`plan_exit` pattern.** A tool that asks the user a structured question
  and synthesizes the next-agent message on approval. Replace the
  free-text question with a Portarium approval card (PolicyTierBadge,
  BlastRadiusBadge, evidence preview) and the inline `Question.Service`
  with a route through `MachineInvokerPort` so the gate is durable across
  cockpit restart and overnight wait (per Portarium memory: agents must
  block indefinitely on approval, not timeout).
- **`Hooks` plugin contract.** Mirror the named hooks
  (`permission.ask`, `tool.execute.before/after`, `chat.params`,
  `shell.env`, `experimental.chat.system.transform`) so OpenCode plugins
  could be ported to Portarium with a thin adapter.
- **Workspace adapter shape** (`configure / create / remove / target` ->
  local | remote). This is the seed of `SandboxProviderPort`; Portarium
  must extend the `target` discriminator to include `vm`, `container`,
  `worktree` and require `evidence` plus `ttl` on the result.
- **Server-as-bus + SDK generation from OpenAPI.** Portarium's cockpit
  already generates types; mirroring OpenCode's "OpenAPI is the contract,
  SDK is generated, plugins consume the SDK" loop keeps the boundary clean.
- **mDNS LAN discovery** of running agent servers. Useful for the
  Sandbox Execution Plane: a sandbox VM publishes its agent server on
  mDNS and the cockpit auto-discovers.
- **Bash arity parsing for permissions** (`tool/shell.ts` + `permission/arity.ts`).
  Per-binary, per-flag permission attribution beats the typical "allow all
  shell or none" sledgehammer.

## What to MODIFY for governance

- **Sandbox boundary.** OpenCode runs against the host filesystem inside a
  git worktree. Portarium must run OpenCode (or any agent) **inside** the
  sandbox -- VM by default, container/worktree only when policy permits.
  The `SandboxProviderPort` provisions the sandbox; the agent server runs
  there; the cockpit talks HTTP/WS into the sandbox via `PreviewPort`.
  Plugin extension hooks then attach to the in-sandbox server.
- **Permission engine policy layer.** Today `Permission.fromConfig` merges
  defaults + user config + agent rules. Portarium adds an
  `EngineeringRuntimePolicyV1` layer **above** user config that may upgrade
  `allow` -> `ask` or `ask` -> `deny` but never silently downgrade. Wire
  the `permission.ask` plugin hook to this resolver.
- **Approval gate UI.** Replace OpenCode's inline `dialog-confirm` with the
  cockpit Bead Detail / Sandbox Route approval card carrying `PolicyTierBadge`
  and `BlastRadiusBadge`. The `permission.asked` bus event is the trigger;
  the reply (`once` / `always` / `reject`) is the resolution. Persist the
  request id so an overnight-wait approval still resolves the original
  pending tool call (Portarium's "approval-wait loop" requirement).
- **Plan -> build is the canonical approval seam.** Wrap `plan_exit` so the
  build phase only starts after the cockpit's `DiffApprovalSurface` records
  approval evidence (plan diff, policy decision, who approved). Keep the
  synthesized "execute the plan" message but stamp it with the approval id.
- **Evidence collection.** Subscribe `ArtifactCollector` to OpenCode's
  bus events: `permission.asked`, `permission.replied`, `worktree.ready`,
  `session.*`, `provider.*`, plus the SSE response stream. Persist as
  `EngineeringSandboxV1` evidence per the inspiration-validation-plan.
- **Scoped credentials.** OpenCode's `Auth.Service` issues long-lived OAuth
  refresh tokens stored under `Global.Path`. Inside a Portarium sandbox the
  agent must instead receive **sandbox-scoped, TTL-bounded credentials**
  injected by `MachineInvokerPort`, with `auth.loader` returning the scoped
  token. Make `OPENCODE_SERVER_PASSWORD` mandatory, not optional (today the
  serve command warns but starts).
- **ACP server upgrade.** Portarium's ACP bridge should: (a) actually surface
  permission requests to the client instead of auto-approving, (b) stream
  tool calls so a remote client sees evidence, (c) expose mode switching so
  Portarium policy decisions propagate to ACP clients. This makes any
  ACP-aware editor (Zed) governed-by-Portarium for free.

## What to AVOID

- **Direct host-filesystem execution.** OpenCode happily runs arbitrary
  bash on the host. Never permissible outside the sandbox in Portarium.
- **`OPENCODE_SERVER_PASSWORD` optional.** A bare `opencode serve` is an
  unauthenticated agent on localhost. Portarium must require auth at boot.
- **Auto-approving permission requests in ACP.** The current `acp/` README
  explicitly admits to this. Vendoring this behaviour would defeat Portarium.
- **`dialog-go-upsell.tsx` and any "Console" / paid-tier prompts** in
  `cli/cmd/tui/component/`. These are SST commercial onboarding -- strip
  before vendoring any TUI component.
- **mDNS publication on by default.** OpenCode publishes the agent server
  on the LAN unless hostname is loopback. For sandbox-bound agents this
  must be opt-in and policy-gated.
- **Plugin auto-install from npm at runtime** (`plugin/loader.ts` +
  `Npm` helper). Inside a governed sandbox, plugins must be pre-baked into
  the image; runtime fetch from npm crosses the trust boundary.
- **`shell.env` plugin hook injecting arbitrary env.** Useful in dev,
  dangerous in prod -- this hook is a credential-exfil path. Restrict
  to allow-listed plugins inside Portarium.
- **One-server-many-workspaces switch via untrusted header**
  (`x-opencode-directory`). Portarium should bind one agent server to one
  sandbox per process; cross-workspace muxing is a sandbox-escape vector.
- **Effect HttpApi backend coupling.** OpenCode is mid-migration between
  Hono and Effect HttpApi. Pinning to either today is risky; consume only
  the OpenAPI surface and the Hooks contract, not the runtime layers.

## Concrete artifacts referenced

| Artifact path                                          | What it is                                                                                      | Relevance to Portarium                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `LICENSE`                                              | MIT license text                                                                                | License compliance basis for any vendoring                                                |
| `README.md`                                            | Top-level project overview                                                                      | Confirms agent profile model and TUI stance                                               |
| `AGENTS.md`                                            | Style / contributor rules for the repo                                                          | Reference for how SST scopes agents internally                                            |
| `package.json`                                         | Workspace layout, Bun runtime, package list                                                     | Shows monorepo split: engine, plugin, sdk, ui, desktop, console                           |
| `packages/opencode/src/agent/agent.ts`                 | Agent profile schema + built-in build/plan/general/explore agents                               | Direct model for Portarium runtime profiles; map to `EngineeringRuntimePolicyV1` outcomes |
| `packages/opencode/src/permission/index.ts`            | Permission engine: rules, ask/allow/deny, deferred replies, persistence                         | Vendor the schema; wrap with Portarium policy layer                                       |
| `packages/opencode/src/permission/evaluate.ts`         | Wildcard rule evaluator (15 lines)                                                              | Vendor verbatim                                                                           |
| `packages/opencode/src/provider/provider.ts`           | Provider registry over Vercel AI SDK                                                            | Pattern for `AgentRuntimePort` provider registration                                      |
| `packages/opencode/src/provider/models.ts`             | models.dev metadata loader                                                                      | Reference for model catalogue surfacing                                                   |
| `packages/opencode/src/server/server.ts`               | Hono + Effect HttpApi server with workspace middleware                                          | Shape of the in-sandbox agent server Portarium hosts                                      |
| `packages/opencode/src/tool/tool.ts`                   | Tool definition contract (`Def`, `Context`, `ask`)                                              | Direct shape for Portarium tool-call permission flow                                      |
| `packages/opencode/src/tool/plan.ts` + `plan-exit.txt` | The plan -> build approval handoff tool                                                         | Canonical seam for Portarium's approval gate between phases                               |
| `packages/opencode/src/tool/shell.ts`                  | Bash tool with tree-sitter argv parsing                                                         | Reference for fine-grained shell permission attribution                                   |
| `packages/opencode/src/worktree/index.ts`              | git worktree provisioning + bus events                                                          | Reference for `SandboxProviderPort.local-worktree` adapter                                |
| `packages/opencode/src/acp/agent.ts` + `README.md`     | Agent Client Protocol JSON-RPC server                                                           | Wire protocol Portarium should speak; current implementation has gaps to fix              |
| `packages/opencode/src/cli/cmd/serve.ts`               | `opencode serve` CLI entry                                                                      | Reference for headless agent boot inside sandbox                                          |
| `packages/opencode/src/cli/cmd/tui/app.tsx`            | Solid.js + OpenTUI root component, dialog/route wiring                                          | Reference for terminal UX patterns; do NOT vendor (keep cockpit web-first)                |
| `packages/opencode/src/config/keybinds.ts`             | ~150 named default keybinds                                                                     | Vendor schema for Portarium's keybind config                                              |
| `packages/opencode/src/config/config.ts`               | Config loader: layered merge of agent/keybinds/lsp/mcp/permission/plugin/provider/server/skills | Reference for Portarium's layered runtime config                                          |
| `packages/opencode/src/plugin/loader.ts`               | Plugin resolve/import pipeline with retry                                                       | Reference for Portarium plugin loader inside sandbox                                      |
| `packages/plugin/src/index.ts`                         | Plugin SDK: `Hooks` contract, `WorkspaceAdapter`, `AuthHook`, `ProviderHook`                    | The most important single file for Portarium hook design                                  |
| `packages/plugin/src/tui.ts`                           | TUI plugin SDK                                                                                  | Reference if Portarium ever ships a TUI client                                            |
| `packages/opencode/specs/tui-plugins.md`               | TUI plugin spec doc                                                                             | Reference for plugin manifest design                                                      |
| `packages/sdk/js/`                                     | Generated TS SDK from OpenAPI                                                                   | Reference for cockpit SDK generation pipeline                                             |
| `packages/desktop/`, `packages/desktop-electron/`      | Tauri + Electron shells over the TUI                                                            | Evidence the client/server split allows multiple shells                                   |
| `packages/containers/README.md`                        | CI build images only -- not runtime sandboxes                                                   | Confirms OpenCode does not ship its own sandbox; Portarium fills this gap                 |

## Port mapping (OpenCode boundary -> Portarium port)

| OpenCode boundary                                              | Portarium port                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider.ts` BUNDLED_PROVIDERS + AI SDK                       | `AgentRuntimePort` (LanguageModelV3 as the inner contract)                                                                                   |
| `Agent.Service` profiles                                       | Runtime profile materialized by `EngineeringRuntimePolicyV1`                                                                                 |
| `Permission.Service` + `permission.ask` plugin hook            | Policy engine called by `AgentRuntimePort`, gate exposed via cockpit approval surface                                                        |
| `experimental_workspace.register(type, WorkspaceAdapter)`      | `SandboxProviderPort` (extend `target` to include `vm` / `container`)                                                                        |
| `Server.listen` + `serve` CLI                                  | The agent server **inside** each sandbox; `PreviewPort` exposes its URL                                                                      |
| `Bus` events (`permission.*`, `worktree.*`, session/run state) | `ArtifactCollector` evidence stream into `EngineeringSandboxV1`                                                                              |
| `Auth.Service`                                                 | Replaced by `MachineInvokerPort`-issued sandbox-scoped credentials                                                                           |
| ACP server (`acp/`)                                            | The wire protocol Portarium speaks to external clients (Zed today, more later) -- but with real permission surfacing and tool-call streaming |
| `tool/plan.ts` `plan_exit` handoff                             | Canonical approval gate between Portarium plan and build phases                                                                              |
