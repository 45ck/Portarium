# Explanation: Ports and Adapters

Portarium uses stable **Ports** for capability contracts and **Adapters** for provider implementations.

## Why this model

- Domain and application logic remain provider-agnostic.
- Adapter behavior is contract-tested.
- Capability matrices make support boundaries explicit.

## Core terms

- Port: stable interface for business capability
- Adapter: provider-specific implementation of a Port
- Capability Matrix: declared support and constraints for an adapter

These definitions align with `docs/glossary.md`.

## References

- `docs/domain/port-taxonomy.md`
- `docs/integration-catalog/README.md`
- `docs/adr/0026-port-taxonomy-aligned-to-business-coverage.md`
