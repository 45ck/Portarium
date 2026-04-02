# Scientific Synthesis

## Scope

This document summarizes the completed live experiments in this branch as actual engineering
experiments rather than demo stories.

Included runs:

- `growth-studio-openclaw-live`
- `micro-saas-agent-stack`

Not included:

- `openclaw-governance` because its pack exists but no result bundle has been recorded yet

## Story

The experiment sequence tells a coherent story:

1. The first live run tested the smallest meaningful governed OpenClaw loop.
   OpenClaw read Growth Studio inputs, attempted writes, paused for approvals, resumed after
   operator approval, and produced a bounded output bundle.
2. That run proved the core control-plane governance loop but also exposed a defect in Portarium's
   evidence visibility path.
3. The second live run expanded the problem from artifact drafting to a longer micro-SaaS lifecycle.
   OpenClaw produced content, queued outbound actions into fake systems, updated fake CRM state, and
   generated a stub landing page that was then exercised in a browser.
4. That longer run proved the agent stack can sustain a more autonomous workflow, but it also found
   host-level verification weaknesses in the browser QA path.

The main scientific conclusion is not "the system is perfect". It is:

- the governed agent loop works end to end under realistic local conditions
- the observability and verifier layers still contain important flaws and host-specific failure modes

## Evidence Table

| Experiment                    | Hypothesis status | Strongest evidence                                                                                                                     |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `growth-studio-openclaw-live` | `confirmed`       | `15` approvals approved, `42` evidence records, `5` output artifacts, live OpenClaw run with governed `read` + `write`                 |
| `micro-saas-agent-stack`      | `confirmed`       | `33` approvals approved, `90` evidence records, `8` output artifacts, stub email/social/CRM updates, browser-verified analytics events |

Primary local evidence artifacts:

- [growth-studio-openclaw-live/outcome.json](./growth-studio-openclaw-live/results/outcome.json)
- [growth-studio-openclaw-live/evidence.json](./growth-studio-openclaw-live/results/evidence.json)
- [growth-studio-openclaw-live/timeline.ndjson](./growth-studio-openclaw-live/results/timeline.ndjson)
- [micro-saas-agent-stack/outcome.json](./micro-saas-agent-stack/results/outcome.json)
- [micro-saas-agent-stack/evidence.json](./micro-saas-agent-stack/results/evidence.json)
- [micro-saas-agent-stack/stub-state.after-qa.json](./micro-saas-agent-stack/results/stub-state.after-qa.json)
- [micro-saas-agent-stack/playwright-qa/qa-report.json](./micro-saas-agent-stack/results/playwright-qa/qa-report.json)

## Flaws Found

The completed experiments did find real flaws.

### 1. Portarium evidence visibility gap

Found in `growth-studio-openclaw-live`.

- Approval and proposal evidence existed internally.
- The runtime evidence view did not expose the full appended evidence stream.
- Result: the first live behavior pass proved agent behavior but under-reported evidence.
- Status: fixed in this branch and verified by the rerun that captured `42` evidence records.

### 2. Browser verifier instability on this Windows host

Found in `micro-saas-agent-stack`.

- `manual-qa-machine` is installed and toolchain-ready.
- Its `agent-browser` dependency could not auto-launch Chrome reliably on this workstation.
- Result: the preferred independent verifier failed before completing the browser run.
- Status: not fixed in `manual-qa-machine`; the experiment runner now records that failure and
  uses a Playwright fallback so the experiment can still complete with browser evidence.

### 3. Host-specific browser noise

Found in `micro-saas-agent-stack`.

- Browser verification surfaced a missing `favicon.ico` request and `net::ERR_ABORTED` client-side
  noise around analytics POSTs even though the preview server received the events.
- Result: the initial fallback oracle over-counted benign noise as failure.
- Status: fixed in the experiment verifier by separating actionable failures from known benign
  host noise.

### 4. OpenClaw plugin path-hint mismatch warning

Observed in both live OpenClaw experiments.

- The plugin manifest/config id is `portarium`.
- The package directory is still named `openclaw-plugin`.
- Result: `openclaw doctor` emits a non-blocking warning.
- Status: still open as a cleanup issue.

### 5. Environment and toolchain fragility

Observed during experiment execution.

- Initial OpenRouter quota exhaustion blocked one live attempt.
- `demo-machine` is present on disk but not runnable on this workstation.
- `ci:pr` is still blocked repo-wide by the missing `dependency-cruiser` entrypoint.

These are not product-behavior failures, but they are real reproducibility and maintenance flaws.

## Threats To Validity

The experiments are useful, but they are not complete proof of production readiness.

- Both completed runs used local or stubbed side-effect systems rather than real external
  delivery channels.
- Approval was exercised with a separate operator identity, but still automated inside the runner.
- Browser verification in the second run required a fallback verifier because the preferred QA
  harness failed on this host.
- The completed runs were executed on one workstation class, primarily Windows.
- The first experiment validated governed drafting and staging, not real execution-plane dispatch.

## Conclusion

The experiments are scientifically useful because they produced both confirmations and defects.

What is confirmed:

- Portarium can govern a live OpenClaw workflow end to end.
- OpenClaw can operate inside a sealed workspace, pause on governed actions, and resume after
  approval.
- A longer micro-SaaS rehearsal can complete with recorded artifacts, queue state, and browser
  evidence.

What is not yet proven:

- real outbound dispatch under non-stub execution
- stable cross-host browser verification through `manual-qa-machine`
- production-strength reproducibility without environment-specific caveats

## Next Experiments

- Run `openclaw-governance` and record its first real result bundle.
- Fix `manual-qa-machine` / `agent-browser` auto-launch on Windows, then rerun
  `micro-saas-agent-stack` without fallback.
- Replace the stub action runner with a real governed execution-plane path for one tightly bounded
  external action.
- Fix the repo-level `dependency-cruiser` path bug so experiment work can clear the full CI chain.
