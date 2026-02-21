# OpenClaw Tool Blast-Radius Policy v1

## Purpose

Define how OpenClaw Gateway tool and skill identifiers are mapped to Portarium execution tiers so risky operations cannot auto-run.

## Scope

- Applies to OpenClaw tool invocation policy checks.
- Applies to both tool names and skill identifiers (same classifier rules).
- Produces deterministic policy outcomes before dispatch.

## Tier Mapping

| Risk category | Minimum execution tier | Examples                                                     | Rationale                                                                                      |
| ------------- | ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `ReadOnly`    | `Auto`                 | `read:file`, `list:records`, `search`                        | Non-mutating retrieval and analysis operations have low blast radius.                          |
| `Mutation`    | `HumanApprove`         | `write:file`, `update:ticket`, `send:email`, `publish`       | External side effects require explicit human approval or stricter tier.                        |
| `Dangerous`   | `ManualOnly`           | `shell.exec`, `powershell`, `browser.playwright`, `selenium` | Host command execution and browser automation are high risk and must remain manually governed. |
| `Unknown`     | `HumanApprove`         | Unclassified custom identifiers                              | Fail-safe default to reduce blast radius.                                                      |

## Classification Precedence

When a name could match multiple patterns, classification order is:

1. `Dangerous`
2. `Mutation`
3. `ReadOnly`
4. `Unknown`

## Evaluation Semantics

- If `policyTier` is at least the mapped minimum tier, decision is `Allow`.
- If `policyTier` is below the mapped minimum tier, decision is `Deny`.
- Denied evaluations must surface run state `PolicyBlocked`.
- Policy-tier validation over agent `allowedTools` must return one violation entry per blocked tool.

## Reference Implementation

- `src/domain/machines/openclaw-tool-blast-radius-v1.ts`
- `src/domain/machines/openclaw-tool-blast-radius-v1.test.ts`
- `src/domain/machines/machine-registration-v1.ts`
