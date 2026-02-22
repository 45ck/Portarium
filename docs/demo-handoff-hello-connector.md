# Demo Handoff: Hello Connector Integration Showcase

> Bead: bead-0730 — Integration showcase level-2

This document guides a developer through the `hello-connector` scaffold from
first principles to a working integration in approximately 30 minutes.

---

## What You'll Build

A custom Portarium connector that:
1. Implements the `HelloConnectorAdapterPort` (or your own port).
2. Passes the contract test suite against a stub adapter.
3. Calls a real external HTTP endpoint via `HelloConnectorAdapter`.

---

## Prerequisites

- Node.js ≥ 20
- A Portarium workspace running locally (`docker compose up`)
- Access to the repo root: `cd /path/to/portarium`

---

## Step 1 — Run the scaffold demo

```bash
cd examples/hello-connector

# Point at a mock server (or use the stub)
HELLO_BASE_URL=http://localhost:9000 HELLO_TOKEN=dev npx tsx connector.ts
```

Expected output:
```
[hello-connector] connecting to http://localhost:9000
[hello-connector] ping → error: ...   ← no server running, expected
```

Run against the stub by importing `StubHelloConnector` instead — no server needed:

```ts
import { StubHelloConnector } from './connector.js';

const c = new StubHelloConnector();
console.log(await c.ping()); // { ok: true, value: { latencyMs: 0 } }
```

---

## Step 2 — Run the contract tests

```bash
# From repo root:
npm run test -- src/infrastructure/adapters/hello-connector.test.ts --run
```

All 15 tests should pass. These tests are the **contract** every connector must
satisfy — they document the required behaviour independently of implementation.

---

## Step 3 — Build your own connector

### 3a. Define your port

Replace `HelloConnectorAdapterPort` with the operations your system supports:

```ts
export interface MySystemAdapterPort {
  createTicket(subject: string, priority: 'low' | 'high'): Promise<Result<Ticket>>;
  closeTicket(id: string): Promise<Result<void>>;
}
```

### 3b. Implement the live adapter

```ts
export class MySystemAdapter implements MySystemAdapterPort {
  constructor(private config: { baseUrl: string; token: string }) {}

  async createTicket(subject: string, priority: 'low' | 'high') {
    const res = await fetch(`${this.config.baseUrl}/tickets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ subject, priority }),
    });
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
    return { ok: true as const, value: await res.json() as Ticket };
  }

  async closeTicket(id: string) {
    const res = await fetch(`${this.config.baseUrl}/tickets/${id}/close`, { method: 'POST', ... });
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
    return { ok: true as const, value: undefined };
  }
}
```

### 3c. Implement the stub

```ts
export class StubMySystemAdapter implements MySystemAdapterPort {
  public tickets: Ticket[] = [];
  public reachable = true;

  async createTicket(subject: string, priority: 'low' | 'high') {
    if (!this.reachable) return { ok: false as const, error: 'offline' };
    const ticket: Ticket = { id: `t-${this.tickets.length}`, subject, priority, status: 'open' };
    this.tickets.push(ticket);
    return { ok: true as const, value: ticket };
  }

  async closeTicket(id: string) {
    if (!this.reachable) return { ok: false as const, error: 'offline' };
    const t = this.tickets.find(t => t.id === id);
    if (!t) return { ok: false as const, error: 'not found' };
    t.status = 'closed';
    return { ok: true as const, value: undefined };
  }
}
```

### 3d. Write contract tests

Copy `src/infrastructure/adapters/hello-connector.test.ts` to
`src/infrastructure/adapters/my-system-connector.test.ts` and
update the test cases to exercise your operations.

---

## Step 4 — Wire into the infrastructure layer

Once your adapter is working in isolation, register it in the DI container
so workflow packs can use it:

```ts
// src/infrastructure/composition-root.ts (or equivalent)
container.bind<MySystemAdapterPort>(MY_SYSTEM_PORT).to(MySystemAdapter);
```

In tests, swap it for the stub:

```ts
container.bind<MySystemAdapterPort>(MY_SYSTEM_PORT).to(StubMySystemAdapter);
```

---

## Connector checklist

- [ ] Port interface defined (one function per operation).
- [ ] Live adapter passes real HTTP calls through the port.
- [ ] Stub adapter satisfies the same interface for testing.
- [ ] Contract tests cover success + error + network failure cases.
- [ ] Adapter registered in composition root (live) and test container (stub).
- [ ] `README.md` documents env vars and quick-start.

---

## Reference: hello-connector files

| File | Purpose |
|---|---|
| `examples/hello-connector/connector.ts` | Port interface, live adapter, stub adapter, demo entrypoint |
| `examples/hello-connector/package.json` | Standalone package metadata |
| `examples/hello-connector/README.md` | Quickstart + architecture diagram |
| `src/infrastructure/adapters/hello-connector.test.ts` | 15-test contract suite |
| `docs/demo-handoff-hello-connector.md` | This file |
