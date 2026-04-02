# Micro-SaaS Agent Stack

## Bead

- `bead-0999`

## Hypothesis

A single OpenClaw agent, governed by Portarium and using local tool repos as agent-usable tools
rather than Portarium machine registrations, can complete a stubbed micro-SaaS growth cycle end to
end without uncontrolled external side effects.

The governed cycle for this experiment is:

1. Read a product brief and target-market inputs.
2. Generate launch copy and campaign drafts.
3. Stage publish/send actions into fake social and fake email systems.
4. Pause on risky outbound actions until Portarium approvals are granted.
5. Run QA verification against the generated funnel and review artifacts.
6. Produce an operator-facing evidence bundle for Cockpit review.

## Scope

This experiment is about orchestration, governance, and reproducibility.

It does not:

- treat `content-machine`, `demo-machine`, `manual-qa-machine`, or `prompt-language` as Portarium
  machine registrations in this slice
- send real outbound email or social posts
- require live production analytics or billing integrations

## Evidence

The experiment is considered confirmed when:

- the local toolchain repos are discovered and classified correctly as tools or harnesses
- fake social, fake email, fake CRM, and fake analytics fixtures exist and are wired into the plan
- the execution plan clearly separates actor, governance, operator, and verifier responsibilities
- the experiment pack is reproducible from Git with tracked setup and fixture inputs
