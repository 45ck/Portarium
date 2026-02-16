---
name: architecture-guard
description: Validate architecture boundaries (dependency-cruiser) and generate a dependency graph.
disable-model-invocation: true
argument-hint: ''
allowed-tools: Read, Grep, Glob, Bash(npm run depcruise), Bash(npm run depgraph:mermaid)
---

# Architecture Guard

## Commands

- Validate: `npm run depcruise`
- Graph: `npm run depgraph:mermaid`

## Evidence

- Write `reports/architecture/ARCH_REPORT.md` with:
  - Cycle count (must be 0)
  - Boundary violations (must be 0)
  - Notes for any exemptions (require ADR)
