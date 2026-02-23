# Technical Webinar Runbook

Operational playbook for running a Portarium technical webinar. Covers
planning, preparation, execution, and follow-up for a 45-minute live
session targeting potential adopters and design partners.

## Format

- **Duration:** 45 minutes (30 min presentation + 15 min Q&A).
- **Platform:** Zoom/Google Meet with screen sharing. Record for async viewers.
- **Audience:** 10-50 attendees (engineers, platform leads, compliance officers).
- **Cadence:** Monthly or as needed for design-partner pipeline fill.

## Timeline

### T-3 weeks: Planning

- [ ] Choose topic (see Topic Menu below).
- [ ] Confirm presenter(s) and backup presenter.
- [ ] Create registration page (Luma, Eventbrite, or GitHub Discussions).
- [ ] Draft promotional copy for: GitHub Discussions, Discord, Twitter/X, LinkedIn.

### T-2 weeks: Promotion

- [ ] Post announcement on all channels.
- [ ] Send direct invitations to design-partner pipeline candidates.
- [ ] Pin announcement in Discord #announcements.
- [ ] Schedule reminder posts for T-1 week and T-1 day.

### T-1 week: Preparation

- [ ] Finalise slide deck (see Slide Template below).
- [ ] Prepare live demo environment:
  - `docker compose up` confirmed working.
  - Demo workspace seeded with sample workflows.
  - Demo data includes at least one approval workflow with evidence chain.
- [ ] Dry run with backup presenter (record for reference).
- [ ] Test screen sharing, audio, and recording.
- [ ] Prepare Q&A cheat sheet (common questions + answers).

### T-1 day: Final check

- [ ] Send reminder email to registrants with join link and agenda.
- [ ] Verify demo environment is still running and data is fresh.
- [ ] Test internet connection, microphone, camera.
- [ ] Load slides and demo tabs in browser.

### T-0: Execution

**Before start (10 min early):**

- Open meeting room and start recording.
- Post join link in Discord #events.
- Mute all attendees on entry.

**Presentation (30 min):**

1. Welcome + housekeeping (2 min)
   - Introduce yourself and Portarium.
   - "Questions in chat; we'll take them at the end."
   - "Recording will be shared afterward."

2. Problem statement (5 min)
   - Why governed workflows matter.
   - Pain points: audit gaps, manual approvals, compliance drift.

3. Portarium overview (8 min)
   - Architecture: hexagonal, domain-driven, event-sourced.
   - Key concepts: workflows, runs, evidence chains, vertical packs.
   - Deployment: Docker Compose for dev, Helm for production.

4. Live demo (12 min)
   - Start a workflow run via the SDK or Cockpit UI.
   - Show the approval gate in action.
   - Walk through the evidence chain.
   - Show the AI advisor summary (if available).
   - Verify the evidence chain cryptographic hash.

5. Getting started (3 min)
   - Quickstart link: `docs/getting-started/hello-portarium.md`.
   - Design-partner programme: `docs/adoption/design-partner-pipeline.md`.
   - Community channels: Discord, GitHub Discussions.

**Q&A (15 min):**

- Take questions from chat in order.
- If a question requires code: share screen and show the relevant file.
- For questions you cannot answer: "Great question -- I'll follow up on Discord."
- End with: "Thank you! Recording will be posted within 24 hours."

### T+1 day: Follow-up

- [ ] Upload recording to YouTube (unlisted) or project docs.
- [ ] Post recording link on all channels.
- [ ] Send follow-up email to registrants:
  - Recording link.
  - Quickstart link.
  - Design-partner application link.
  - Feedback form (3 questions: What was most useful? What was unclear? Would you recommend?).
- [ ] Log attendee count and feedback scores.
- [ ] Add interested attendees to design-partner pipeline (Stage 1).

## Topic Menu

Rotate through these topics across webinars:

1. **Intro to Portarium** — Architecture, quickstart, first workflow run.
2. **Building a Vertical Pack** — Scaffold, develop, test, publish.
3. **Evidence Chains Deep Dive** — Cryptographic audit trail, verification, compliance.
4. **AI-Assisted Approvals** — Advisor summaries, confidence signals, agency boundaries.
5. **Multi-Tenant Deployment** — Workspace isolation, RBAC, OIDC federation.
6. **Robotics Integration** — ROS 2, DDS-Security, SPIFFE identity, mission workflows.

## Slide Template

Keep slides minimal (max 20 slides for 30 min):

- Slide 1: Title + presenter name.
- Slide 2: Agenda.
- Slides 3-5: Problem statement (pain points, market context).
- Slides 6-10: Architecture and key concepts.
- Slide 11: "Let me show you" (transition to demo).
- Slides 12-15: Demo recap with screenshots (for async viewers).
- Slide 16: Getting started + resources.
- Slide 17: Design-partner programme.
- Slide 18: Q&A slide.
- Slide 19: Thank you + links.

## Metrics

Track per webinar:

| Metric              | Target |
| ------------------- | ------ |
| Registrations       | >20    |
| Attendance rate     | >50%   |
| Q&A questions       | >5     |
| Feedback score      | >4/5   |
| Pipeline candidates | >2     |
