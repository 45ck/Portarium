# Portarium GTM Playbook — Technical-Adopter Discovery to Deploy

This playbook maps the [Adoption Ladder](./adoption-ladder.md) to go-to-market touchpoints,
community engagement channels, and conversion triggers.

## Adopter Personas

### 1. Connector Author

**Who:** Integration engineer or ISV building a vertical pack that extends Portarium's capability matrix.

**Primary concern:** How do I package and publish a vertical pack?

**Entry point:** Vertical pack scaffold (`docs/vertical-packs/authoring-guide.md`).

**SDK entry point:** `PortariumClient.packs.register()` — see [SDK Integration Patterns](../sdk/integration-patterns.md#connector-author).

---

### 2. Orchestration Consumer

**Who:** Platform engineer or application developer invoking Portarium workflows from their own services.

**Primary concern:** How do I trigger a workflow and handle the result?

**Entry point:** [Hello Portarium quickstart](../getting-started/hello-portarium.md).

**SDK entry point:** `PortariumClient.runs.start()` — see [SDK Integration Patterns](../sdk/integration-patterns.md#orchestration-consumer).

---

### 3. Governance Reviewer

**Who:** Compliance officer, CISO delegate, or audit team member who reviews evidence chains and approves governed workflows.

**Primary concern:** How do I verify that a run complied with policy?

**Entry point:** Evidence chain verification guide (`docs/explanation/evidence-chain.md`).

**SDK entry point:** `EvidenceChainVerifier` — see [SDK Integration Patterns](../sdk/integration-patterns.md#governance-reviewer).

---

## Discovery Touchpoints

| Channel            | Audience                                    | Content                                                    |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------- |
| GitHub README      | All personas                                | Project overview, architecture diagram, quickstart link    |
| Documentation site | All personas                                | Full reference docs, how-to guides, SDK reference          |
| Demo video         | Orchestration Consumer, Governance Reviewer | 5-minute governance demo (approval gate + evidence review) |
| GitHub Discussions | Connector Author                            | Q&A, vertical pack authoring help                          |
| Discord (TBD)      | All personas                                | Real-time community support                                |

## L0 → L1 Conversion Triggers

An evaluator advances from L0 (Discovery) to L1 (Integration Spike) when:

1. They have completed the Hello Portarium quickstart locally.
2. They have identified a workflow use-case in their own domain.
3. They have access to a staging environment.

Recommended outreach after L0 completion:

- Send the [Adoption Ladder](./adoption-ladder.md) document.
- Offer a 30-minute onboarding call (engineering-led).
- Share the [Adoption Readiness Checklist](./adoption-readiness-checklist.md) to set L3 expectations.

## L1 → L2 Conversion Triggers

1. First SDK workflow run succeeds in staging.
2. Team nominates a Governance Reviewer persona.
3. OpenFGA model deployed to staging.

## L2 → L3 Conversion Triggers

1. Approval gate exercised end-to-end.
2. Platform team reviews the Adoption Readiness Checklist and begins completing items.
3. Production infrastructure provisioned.

## Community Engagement

- **GitHub Issues:** Bug reports and feature requests.
- **GitHub Discussions:** Architecture questions, integration patterns, best practices.
- **Discord:** (Placeholder — invite link to be added when community server is live.)
- **Office Hours:** Bi-weekly open call for adopters at L1+ (schedule TBD).
