# Contributing To Portarium

Thanks for considering a contribution. Portarium is an OSS control plane for governed AI agents, so the highest-value contributions make the agent governance loop safer, clearer, easier to run, or easier to test.

## Start Here

Read these first:

1. [README](README.md)
2. [Project scope](docs/project-scope.md)
3. [Docs index](docs/index.md)
4. [Contributor onboarding](docs/getting-started/contributor-onboarding.md)
5. [Glossary](docs/glossary.md)

Agents and maintainers should also read [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

## What To Work On

Good first contribution areas:

- docs that make setup or agent integration clearer
- tests for allowed, approval-required, denied, blocked, retry, and isolation paths
- SDK examples for proposing and waiting on governed actions
- small adapter examples
- security hardening with focused tests
- Cockpit polish for approvals, policies, runs, and evidence

Avoid treating showcase projects as core blockers. Growth Studio, mission-control UI, prompt-language, demo-machine, and pilot research are future work unless your change directly hardens the core governance loop.

## Workflow

Every contribution should follow this order:

```text
Spec or issue -> implementation -> tests -> quality gates -> review -> merge
```

This repo tracks work in Beads. For local issue commands:

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX
npm run bd -- issue start bead-XXXX --by "<owner>"
npm run bd -- issue finish bead-XXXX
```

Commit `.beads/issues.jsonl` with related code changes when Bead state changes.

## Local Setup

```bash
npm ci
npm run dev:all
npm run dev:seed
npm run smoke:governed-run
```

More detail: [local development](docs/getting-started/local-dev.md).

## Quality Gates

Before opening or updating a PR:

```bash
npm run ci:pr
```

For documentation-only changes, also run:

```bash
npm run docs:lint
```

Do not claim work is complete until the relevant gates pass or the remaining blocker is clearly documented in the PR.

## Architecture Rules

- Keep domain code free of infrastructure and presentation imports.
- Use the vocabulary in [docs/glossary.md](docs/glossary.md).
- Update specs when behavior changes.
- Add or update ADRs for architecture changes.
- Prefer small, testable changes over broad rewrites.

## Pull Request Checklist

Include:

- linked Bead or issue
- what changed
- why it matters for the core governance loop
- tests and gates run
- screenshots or clips for UI changes
- known risks or follow-up work

## Security

Do not report vulnerabilities in public issues. Use [SECURITY.md](SECURITY.md).

## Code Of Conduct

Be direct, constructive, and respectful. Assume good intent, focus on the work, and help keep the project useful for builders who need reliable agent governance.

## License

By contributing, you agree that your contributions are licensed under the MIT License in [LICENSE](LICENSE).
