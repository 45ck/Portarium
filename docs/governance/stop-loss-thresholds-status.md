# Stop-Loss Threshold Evaluation

Generated: 2026-02-20T02:59:43.554Z
Source: `.beads/issues.jsonl`

## Thresholds

- Risk score halt threshold: 6
- Failed gates halt threshold: 1
- Unresolved open decisions halt threshold: 8

## Metrics

- Open beads: 164
- Deadlock cycles: 0
- Orphaned beads: 136
- Open P0 beads: 2
- Unowned open beads: 163
- Unresolved open decisions: 30
- Failed gates input: (none)

## Risk

- Risk score: 6
- Risk components: orphaned_beads_threshold, unowned_open_beads_threshold, unresolved_decision_threshold

## Decision

- Halt cycle: yes
- Reasons: risk score 6 >= threshold 6 | unresolved open decisions 30 >= threshold 8
