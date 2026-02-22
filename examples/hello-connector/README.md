# Hello Connector — Portarium Integration Scaffold

A minimal, runnable starting point for building a custom Portarium connector.

A **connector** adapts an external system (SaaS API, database, IoT device, etc.)
to the Portarium adapter port contract. Once registered, it enables any Portarium
workflow to interact with that system in a governed, audited way.

---

## What This Scaffold Does

`connector.ts` implements the `HelloConnectorAdapterPort` — a tiny example port
that does three things:

| Operation     | Description                                    |
| ------------- | ---------------------------------------------- |
| `ping`        | Round-trip health-check to the external system |
| `sendMessage` | Send a message string to the external system   |
| `getStatus`   | Retrieve current connection status             |

The live connector calls a configurable HTTP endpoint; a provided stub
(`StubHelloConnector`) lets you run the full path in tests without a real server.

---

## Quick Start

```bash
cd examples/hello-connector
npm install      # or: link from repo root — see CLAUDE.md
HELLO_BASE_URL=http://localhost:9000 \
HELLO_TOKEN=dev-token \
  npx tsx connector.ts
```

Expected output:

```
[hello-connector] ping → ok (14 ms)
[hello-connector] sendMessage → delivered
[hello-connector] getStatus → {"connected":true,"uptime":42}
```

---

## File Overview

```
hello-connector/
  connector.ts          ← The connector implementation (copy + modify)
  connector.test.ts     ← Contract tests using StubHelloConnector
  package.json
  README.md             ← This file
```

---

## How to Build Your Own Connector

1. **Copy this directory** and rename it to `my-system-connector/`.

2. **Define your port** — replace `HelloConnectorAdapterPort` with your own
   interface that lists the operations your system supports.

3. **Implement the live adapter** — swap out the `fetch` calls in
   `HelloConnectorAdapter` with calls to your system's SDK or REST API.

4. **Keep the stub** — `StubHelloConnector` mirrors the same interface for
   deterministic unit tests without network calls.

5. **Write contract tests** — model `connector.test.ts`. Every operation you
   expose should have at least one success case and one error case.

6. **Register with Portarium** — once your adapter is wired into the
   infrastructure layer, workflow packs can invoke it via the application port.

---

## Architecture Position

```
Workflow Pack
     │
     ▼
Application Port (HelloConnectorAdapterPort)
     │
     ├─── HelloConnectorAdapter   (live: calls external HTTP/SDK)
     │
     └─── StubHelloConnector      (test: in-memory, deterministic)
```

This mirrors the pattern used by all first-party Portarium adapters under
`src/infrastructure/adapters/`.

---

## Environment Variables

| Variable           | Required | Default | Description                   |
| ------------------ | -------- | ------- | ----------------------------- |
| `HELLO_BASE_URL`   | Yes      | —       | Base URL of the target system |
| `HELLO_TOKEN`      | Yes      | —       | Bearer token for auth         |
| `HELLO_TIMEOUT_MS` | No       | `5000`  | Per-request timeout in ms     |
