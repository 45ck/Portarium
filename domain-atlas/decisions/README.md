# Decisions

This folder holds small, ADR-like notes for domain-atlas synthesis choices that are too detailed for global ADRs.

Examples:

- Why a vendor entity maps to `Party` vs `ExternalObjectRef`.
- Why a field is considered canonical vs extension-only.
- Why an action is treated as non-idempotent (or requires `HumanApprove`) despite retries.
