---
name: architecture-guard
description: Enforce architecture boundaries using dependency-cruiser and generate a dependency graph.
disable-model-invocation: true
argument-hint: '[scope=src]'
allowed-tools: Read, Grep, Glob, Bash(npm run depcruise), Bash(npm run depgraph:mermaid)
---

# Architecture Guard

## Outputs

- `reports/architecture/ARCH_REPORT.md`
- `reports/architecture/dependency-graph.mmd`

## Steps

1. Run `npm run depcruise` — fail if any error-severity violations.
2. Run `npm run depgraph:mermaid` — generate Mermaid dependency graph.
3. Write `reports/architecture/ARCH_REPORT.md` summarising:
   - Cycle count (must be 0)
   - Boundary violations (must be 0)
   - Layer compliance status
   - Fan-in/fan-out hotspots (if detectable)
   - Link to dependency graph
