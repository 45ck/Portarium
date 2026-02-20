# Activepieces Piece Packages

This directory stores Portarium's custom Activepieces piece package pattern.

## Purpose

- Keep per-family connector behavior in reusable piece packages instead of bespoke HTTP logic.
- Standardize correlation header propagation (`tenantId`, `correlationId`, optional `runId`).
- Keep one package pattern reusable across all Port Families.

## Structure

- `pieces/portarium-projects-work-mgmt-piece/`: concrete example package for `ProjectsWorkMgmt`.

## Usage

1. Copy the example package into a new family-specific folder.
2. Rename package metadata (`name`, `description`, piece IDs).
3. Replace operation mappings with the target family capabilities.
4. Keep correlation header propagation unchanged.

## Runtime deployment artifacts

- Docker Compose local stack entry: `docker-compose.yml` (`activepieces`, `activepieces-db`, `activepieces-redis`).
- Helm chart for staging/prod deployments: `infra/helm/activepieces/`.
