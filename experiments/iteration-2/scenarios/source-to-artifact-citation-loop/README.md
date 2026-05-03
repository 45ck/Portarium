# Source To Artifact Citation Loop

Owner Bead: `bead-1103`

Status: runnable deterministic cited source-to-artifact experiment.

## Scenario

A bounded set of trusted Portarium sources is captured as Source Snapshots. The
same source base produces a cited Research Dossier and two downstream Artifact
families:

- a content pack for the demo-only content studio path
- a micro-SaaS opportunity and product brief for the primary self-use proving
  path

The run records citation, confidence, freshness, and claim-boundary context from
source material through the downstream Artifacts. Operator interventions adjust
taste, scope, and evidence quality without turning the whole Run into manual
work.

## Required Evidence

- Source Snapshots are bounded and linked to Evidence Artifact references.
- Every material Research Dossier claim has citations, confidence, freshness,
  and claim-boundary context.
- The content and micro-SaaS Artifacts are produced from the same source base.
- Downstream Artifacts carry forward claim IDs, Source Snapshot IDs, and
  confidence context.
- Operator interventions can request changes, narrow scope, or require more
  evidence while unrelated governed work continues.
- External publication remains blocked when evidence quality is insufficient.

## Run

```bash
node experiments/iteration-2/scenarios/source-to-artifact-citation-loop/run.mjs
```

The script writes `outcome.json`, `queue-metrics.json`,
`evidence-summary.json`, `report.md`, `source-snapshots.json`,
`research-dossier.json`, `downstream-artifacts.json`,
`operator-interventions.json`, and `citation-provenance.json` under this
scenario's `results/` directory. CI runs the same experiment with a temporary
result directory through
`scripts/integration/scenario-source-to-artifact-citation-loop.test.ts`.
