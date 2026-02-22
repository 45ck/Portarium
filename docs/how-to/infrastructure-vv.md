# Infrastructure V&V: Workflow Durability, Outbox Ordering, and Evidence Continuity

> **Audience**: Infrastructure engineers, SRE, and QA leads.
>
> **Goal**: Define the verification plan for infrastructure-layer invariants: durability
> under crash, outbox message ordering, and evidence chain continuity under failure
> injection.

---

## 1. V&V objectives

### 1.1 Workflow durability

> A workflow run that has started and emitted at least one evidence entry must survive:
> - Process restart
> - Database failover
> - Network partition (between orchestrator and adapter)

**Acceptance criterion**: After any single-component failure, the workflow either
completes normally or reaches a deterministic terminal state (`Failed` / `Cancelled`)
with an evidence entry explaining why.

### 1.2 Outbox ordering

> Evidence entries emitted by the outbox must be delivered in the order they were
> committed (FIFO per correlation ID).

**Acceptance criterion**: Under concurrent workload, no two evidence entries for the
same `correlationId` are delivered out of `occurredAtIso` order.

### 1.3 Evidence continuity

> The hash-chained evidence log must remain verifiable (all hashes valid, no gaps)
> even after:
> - Partial write failure (entry committed but hash not yet computed)
> - Read-replica lag (consumer reads stale state)
> - Storage migration

**Acceptance criterion**: `verifyEvidenceChain()` returns `{ ok: true }` for every
completed run's evidence sequence.

---

## 2. Failure injection scenarios

| Scenario | Injection mechanism | Expected behaviour |
|----------|--------------------|--------------------|
| Orchestrator process killed mid-step | `SIGKILL` on orchestrator | Run resumes from last committed step on restart |
| DB write fails at step completion | Mock DB error on `save()` | Step retried; evidence entry not duplicated (idempotency) |
| Outbox flush interrupted | Kill flush goroutine mid-batch | Partially flushed batch re-delivered; consumers are idempotent |
| Network timeout to adapter | Mock timeout on `MisAdapterV1.invoke()` | Step retried up to `maxRetries`; evidence records each attempt |
| DB read returns stale replica | Mock lagging read | Evidence consumer catches up; no hash chain break |
| Storage migration (table rename) | Migrate script applied mid-run | Migration is non-destructive; ongoing runs complete normally |

---

## 3. Test categories

### 3.1 Idempotency tests

Verify that re-processing the same command does not create duplicate evidence entries:

```typescript
// Pseudocode — actual impl in src/infrastructure/vv/outbox-idempotency.test.ts
describe('outbox idempotency', () => {
  it('dispatching the same evidence entry twice produces one record', async () => {
    const entry = makeEvidenceEntry({ evidenceId: 'ev-1', runId: 'run-1' });
    await outbox.dispatch(entry);
    await outbox.dispatch(entry); // second dispatch — same evidenceId
    const records = await evidenceRepo.findByRunId('run-1');
    expect(records).toHaveLength(1); // not 2
  });
});
```

### 3.2 Ordering tests

Verify FIFO delivery per correlation ID:

```typescript
describe('outbox ordering', () => {
  it('entries for the same correlationId are delivered in occurredAtIso order', async () => {
    // Dispatch 10 entries with ascending timestamps
    for (let i = 0; i < 10; i++) {
      await outbox.dispatch(makeEvidenceEntry({ index: i }));
    }
    const delivered = await consumer.drain();
    const timestamps = delivered.map((e) => new Date(e.occurredAtIso).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });
});
```

### 3.3 Evidence chain continuity tests

Verify the hash chain survives a partial write and restart:

```typescript
describe('evidence chain continuity', () => {
  it('chain remains verifiable after restart mid-run', async () => {
    // 1. Start a run and emit 5 evidence entries
    // 2. Inject crash after 3rd entry
    // 3. Restart and complete the run
    // 4. Verify the full 5-entry chain
    const { entries } = await runLifecycle.completeWithCrash({ crashAfter: 3 });
    const result = verifyEvidenceChain(entries);
    expect(result.ok).toBe(true);
  });
});
```

---

## 4. Infrastructure test file locations

| Test file | Covers |
|-----------|--------|
| `src/infrastructure/vv/outbox-idempotency.test.ts` | Outbox deduplication |
| `src/infrastructure/vv/outbox-ordering.test.ts` | FIFO delivery invariant |
| `src/infrastructure/vv/evidence-continuity.test.ts` | Hash chain under failure |
| `src/infrastructure/vv/workflow-durability.test.ts` | Crash recovery |

---

## 5. Acceptance gate

Infrastructure V&V is **complete** when:

- [ ] All failure injection scenarios in section 2 have a passing test
- [ ] `verifyEvidenceChain()` test with simulated crash passes
- [ ] Outbox ordering test passes under 10 concurrent dispatchers
- [ ] Idempotency test covers: duplicate command, duplicate evidence entry, and duplicate outbox flush
- [ ] All tests pass in `npm run ci:nightly` (extended timeout)

---

## 6. Related documents

| Document | Purpose |
|----------|---------|
| `docs/how-to/vv-campaign.md` | V&V campaign overview |
| `src/sdk/evidence-chain-verifier.ts` | Chain verification utility |
| `docs/runbooks/` | Operational runbooks |
| `docs/onboarding/sre-track.md` | SRE onboarding including health probes |
