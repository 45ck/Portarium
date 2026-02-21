# Agent Gateway v1

## Purpose

Define the thin proxy service that sits between external callers (agents, MCP
clients, CLI tools) and the internal control plane. The gateway enforces
authentication, rate limiting, request validation, and trace-context injection
so that the control plane can trust inbound traffic.

## Responsibilities

1. **Auth termination** -- validate JWT / OAuth2 bearer tokens (delegates to
   `AuthVerifier`). mTLS termination is handled at the sidecar/ingress layer.
2. **Rate limiting** -- per-workspace token-bucket rate limiter prevents any
   single workspace from overwhelming the control plane.
3. **Request validation** -- fast-fail on malformed requests (invalid method,
   oversized body, unsupported content type) before proxying.
4. **Trace-context injection** -- injects W3C `traceparent` / `tracestate`
   headers when not already present; passes through existing ones.
5. **Proxying** -- forwards validated requests to the control plane with
   injected `x-workspace-id`, `x-subject`, `x-correlation-id` headers.

## Error Model

All gateway errors use RFC 9457 Problem Details (`application/problem+json`).

| Status | Title             | When                              |
| ------ | ----------------- | --------------------------------- |
| 401    | Unauthorized      | Missing or invalid credentials    |
| 422    | Validation Failed | Malformed request shape           |
| 429    | Too Many Requests | Token bucket exhausted            |
| 502    | Bad Gateway       | Control plane unreachable / error |

## Rate Limiter

- Algorithm: token bucket (in-memory).
- Key: workspace ID extracted from the authenticated token.
- Configurable: `maxTokens` (burst), `refillRatePerSecond` (sustained).
- Returns `Retry-After` header on 429.

## Request Validator

- Allowed methods: GET, POST, PUT, PATCH, DELETE.
- Max body size: 1 MiB (configurable).
- Content-type must be `application/json` or `application/cloudevents+json` for
  body-bearing methods.

## Test Expectations

Unit tests must cover:

- Successful proxy pass-through.
- Auth rejection (401).
- Rate limit rejection (429 with retry-after).
- Invalid request shape (422).
- Upstream failure (502).
- Traceparent injection and forwarding.
