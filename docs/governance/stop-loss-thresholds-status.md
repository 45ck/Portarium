# Stop-Loss Threshold Evaluation

Generated: 2026-02-21T19:01:16.745Z
Source: `.beads/issues.jsonl`

## Thresholds

- Risk score halt threshold: 6
- Failed gates halt threshold: 1
- Unresolved open decisions halt threshold: 8

## Metrics

- Open beads: 134
- Deadlock cycles: 0
- Orphaned beads: 37
- Open P0 beads: 0
- Unowned open beads: 132
- Unresolved open decisions: 23
- Failed gates input: (none)

## Risk

- Risk score: 6
- Risk components: orphaned_beads_threshold, unowned_open_beads_threshold, unresolved_decision_threshold

## Decision

- Halt cycle: yes
- Reasons: risk score 6 >= threshold 6 | unresolved open decisions 23 >= threshold 8
