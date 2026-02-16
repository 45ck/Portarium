#!/usr/bin/env bash
set -euo pipefail

input="${CLAUDE_TOOL_INPUT:-}"

# Block common bypass attempts. Local hooks are convenience; CI is authority.
if [[ "$input" == *"--no-verify"* ]]; then
  echo "ERROR: --no-verify is forbidden in this repository."
  exit 1
fi

if [[ "$input" == *"SKIP_CI"* ]]; then
  echo "ERROR: SKIP_CI is forbidden in this repository."
  exit 1
fi

# Prevent weakening lint gates via ad-hoc flags.
if [[ "$input" == *"eslint "* && "$input" == *"--max-warnings"* ]]; then
  echo "ERROR: Do not modify ESLint flags. Use npm scripts (npm run lint / npm run ci:pr)."
  exit 1
fi

