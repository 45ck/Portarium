# Portarium Domain -- ERD (As Implemented)

> Runtime-aligned model snapshot based on parser contracts in `src/domain/*/*-v1.ts` and repository/query ports in `src/application/ports/*`.

## Aggregate and Entity Map

```mermaid
erDiagram
    WorkspaceV1 {
        string workspaceId PK
        string tenantId
        string name
        string createdAtIso
        string[] userIds
        string[] projectIds
        string[] credentialGrantIds
    }

    WorkspaceUserV1 {
        string userId PK
        string workspaceId FK
        string email
        string[] roles
        bool active
        string createdAtIso
    }

    ProjectV1 {
        int schemaVersion
        string projectId PK
        string workspaceId FK
        string name
        string createdAtIso
    }

    WorkflowV1 {
        int schemaVersion
        string workflowId PK
        string workspaceId FK
        string name
        int version
        bool active
        string executionTier
    }

    WorkflowActionV1 {
        string actionId PK
        int order
        string portFamily
        string capability
        string operation
        string inputSchemaRef
        string outputSchemaRef
        string executionTierOverride
    }

    RunV1 {
        int schemaVersion
        string runId PK
        string workspaceId FK
        string workflowId FK
        string correlationId
        string executionTier
        string initiatedByUserId
        string status
        string createdAtIso
        string startedAtIso
        string endedAtIso
    }

    PlanV1 {
        int schemaVersion
        string planId PK
        string workspaceId FK
        string createdByUserId
        string createdAtIso
    }

    ApprovalV1 {
        int schemaVersion
        string approvalId PK
        string workspaceId FK
        string runId FK
        string planId FK
        string workItemId
        string status
        string prompt
        string requestedByUserId
        string requestedAtIso
        string assigneeUserId
        string dueAtIso
        string decidedByUserId
        string decidedAtIso
        string rationale
    }

    EvidenceEntryV1 {
        int schemaVersion
        string evidenceId PK
        string workspaceId FK
        string correlationId
        string category
        string occurredAtIso
        string hashSha256
        string previousHash
    }

    ArtifactV1 {
        int schemaVersion
        string artifactId PK
        string runId FK
        string evidenceId FK
        string mimeType
        int sizeBytes
        string storageRef
        string hashSha256
        string createdAtIso
        string signatureBase64
    }

    PolicyV1 {
        int schemaVersion
        string policyId PK
        string workspaceId FK
        string name
        bool active
        int priority
        int version
        string createdByUserId
        string createdAtIso
    }

    AdapterRegistrationV1 {
        int schemaVersion
        string adapterId PK
        string workspaceId FK
        string providerSlug
        string portFamily
        bool enabled
    }

    CredentialGrantV1 {
        int schemaVersion
        string credentialGrantId PK
        string workspaceId FK
        string adapterId FK
        string credentialsRef
        string scope
        string issuedAtIso
        string expiresAtIso
        string lastRotatedAtIso
        string revokedAtIso
    }

    WorkItemV1 {
        int schemaVersion
        string workItemId PK
        string workspaceId FK
        string title
        string status
        string createdByUserId
        string createdAtIso
        string ownerUserId
    }

    WorkspaceV1 ||--o{ ProjectV1 : contains
    WorkspaceV1 ||--o{ WorkspaceUserV1 : memberships
    WorkspaceV1 ||--o{ WorkflowV1 : owns
    WorkspaceV1 ||--o{ PolicyV1 : scopes
    WorkspaceV1 ||--o{ AdapterRegistrationV1 : registers
    WorkspaceV1 ||--o{ WorkItemV1 : tracks
    WorkspaceV1 ||--o{ RunV1 : owns
    WorkspaceV1 ||--o{ ApprovalV1 : owns
    WorkspaceV1 ||--o{ PlanV1 : owns
    WorkspaceV1 ||--o{ EvidenceEntryV1 : owns
    WorkspaceV1 ||--o{ CredentialGrantV1 : grants

    WorkflowV1 ||--|{ WorkflowActionV1 : defines
    WorkflowV1 ||--o{ RunV1 : executes_as
    RunV1 ||--o{ ApprovalV1 : gates
    RunV1 ||--o{ ArtifactV1 : emits
    PlanV1 ||--o{ ApprovalV1 : requested_in
    EvidenceEntryV1 ||--o{ ArtifactV1 : linked_payload
    AdapterRegistrationV1 ||--o{ CredentialGrantV1 : authenticated_by
```

## Repository ID and Reference Invariants

- `tenantId` is the top-level storage partition key for all repository reads/writes.
- Stores that accept `(tenantId, workspaceId, id)` return `null` when parsed payload `workspaceId` does not match the requested `workspaceId`.
- Save paths persist aggregate IDs and workspace references from the parsed aggregate, not from caller-provided free-form fields.
- Cross-aggregate links are ID references only:
  - `RunV1.workflowId`
  - `ApprovalV1.runId`, `ApprovalV1.planId`, optional `ApprovalV1.workItemId`
  - `ArtifactV1.runId`, optional `ArtifactV1.evidenceId`
  - `WorkItemV1.links.{runIds,workflowIds,approvalIds,evidenceIds}`
  - `EvidenceEntryV1.links.{runId,planId,workItemId}` (optional, not top-level foreign keys)
- Aggregate-level uniqueness/consistency guards live in `src/application/services/repository-aggregate-invariants.ts`:
  - workspace name uniqueness
  - run ID uniqueness
  - single active workflow version
  - single active adapter per required port family

## Notes

- This ERD is intentionally aligned to implemented parser contracts, not aspirational future models.
- `PlanV1` and `EvidenceEntryV1` are run-correlated by application/orchestration context; their run reference is not a required top-level field in the domain type.
