# Paperless-ngx

- Provider ID: `paperless-ngx`
- Port Families: `DocumentsEsign`
- Upstream: `https://github.com/paperless-ngx/paperless-ngx`
- Pinned commit: `eda0e61cec3f69b6adfe06594654c723f74f2917` (vendored as a git submodule; run `npm run domain-atlas:vendor -- --only paperless-ngx` to ensure checkout)
- License: GPLv3 (`GPL-3.0-only`, `study_only`)

## What To Extract Next

- API payload shapes and invariants (document upload, metadata update, bulk tagging, archive file download).
- Permission model and tenant isolation posture (users, groups, ownership, shared views).
- Storage semantics (original vs archived files, checksum uniqueness, retention/cleanup).
- Share-link semantics and safety controls (expiry, access logging).
- Event surfaces (webhooks, polling opportunities, async OCR/ingest pipeline state machine).

## Current Extraction (Initial)

- CIF: `domain-atlas/extracted/paperless-ngx/cif.json`
- Mapping: `domain-atlas/mappings/paperless-ngx/DocumentsEsign.mapping.json`
- Capability matrix: `domain-atlas/capabilities/paperless-ngx/DocumentsEsign.capability-matrix.json`
- Re-run: `npm run domain-atlas:extract:paperless-ngx`

Entities extracted from Paperless-ngx's Django migrations (initial models + early constraints) under:

- `domain-atlas/upstreams/paperless-ngx/src/documents/migrations/0001_initial.py`
- `domain-atlas/upstreams/paperless-ngx/src/documents/migrations/0002_initial.py`

- `Document`
- `Tag`
- `Correspondent`
- `DocumentType`
- `StoragePath`
- `CustomField`, `CustomFieldInstance`
- `Note` (document notes/comments)

## Mapping Notes (Canonical)

- Canonical `Document` maps to Paperless `Document` (file metadata + checksums + timestamps).
- Canonical `Party` maps to `Correspondent` (sender/issuer counterparty; not a full CRM Party).
- Tags, document types, and storage paths remain provider-native (`ExternalObjectRef`) until canonical categorisation semantics are finalised.

## Capability Matrix Notes

- Treat uploads and metadata changes as externally-effectful and high-liability by default (require approval).
- Idempotency can often be achieved via checksum uniqueness and read-before-write policies, but adapters must avoid leaking document contents by default.

## Open Questions

- Minimal safe evidence capture for documents: metadata-only by default, with explicit policy for content hashing and retention.
- How to model async ingest/OCR status transitions in a portable way across document systems.
