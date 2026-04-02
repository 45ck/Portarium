# OpenClaw Workspace Scaffold

This directory contains the OpenClaw workspace files used in the Portarium governance experiments.
Copy the entire `workspace/` directory to `~/.openclaw-portarium-dev/workspace/` to replicate the
setup used when running the experiments.

## Files

| File           | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `AGENTS.md`    | Agent instruction file — how the agent behaves each session     |
| `BOOTSTRAP.md` | First-run setup prompt — defines agent identity on first launch |
| `HEARTBEAT.md` | Periodic task definitions (empty = no heartbeat)                |
| `IDENTITY.md`  | Agent name, creature, vibe, emoji (fill in on first run)        |
| `SOUL.md`      | Agent personality and core values                               |
| `TOOLS.md`     | Environment-specific tool notes (cameras, SSH, TTS, etc.)       |
| `USER.md`      | Notes about the human operator (fill in on first run)           |

## How to use

```bash
# 1. Copy workspace files
mkdir -p ~/.openclaw-portarium-dev/workspace
cp examples/openclaw/workspace/* ~/.openclaw-portarium-dev/workspace/

# 2. Copy the profile config
mkdir -p ~/.openclaw-portarium-dev
cp examples/openclaw/workspace-config.json ~/.openclaw-portarium-dev/openclaw.json
# Edit the file: replace <YOUR_OPENROUTER_API_KEY>, <HOME>, <REPO_ROOT>

# 3. Start the Portarium control plane (see examples/openclaw/setup.md)

# 4. Run the agent
OPENCLAW_CONFIG_PATH="$HOME/.openclaw-portarium-dev/openclaw.json" \
  openclaw agent --local --session-id portarium-test \
  --message "List files in ~/tmp"
```

The agent will immediately be governed — its first tool call will be intercepted by the
Portarium plugin and suspended until a human approves it.
