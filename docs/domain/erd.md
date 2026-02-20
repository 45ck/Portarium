# Portarium Domain -- ERD (As Implemented)

> Runtime-aligned domain model snapshot based on `src/domain/*-v1.ts`.

## Aggregate and Entity Map

```mermaid
erDiagram
    WorkspaceV1 {
        string workspaceId PK
        string tenantId
        string name
        string createdAtIso
    }

    ProjectV1 {
        string projectId PK
        string workspaceId FK
        string name
        string createdAtIso
    }

    WorkflowV1 {
        string workflowId PK
        string workspaceId FK
        string name
        int version
        string executionTier
        bool active
    }

    WorkflowActionV1 {
        string actionId PK
        int order
        string portFamily
        string operation
        string executionTierOverride
    }

    RunV1 {
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
        string planId PK
        string workspaceId FK
        string createdByUserId
        string createdAtIso
    }

    ApprovalV1 {
        string approvalId PK
        string workspaceId FK
        string runId FK
        string planId
        string status
        string requestedByUserId
        string requestedAtIso
        string decidedByUserId
        string decidedAtIso
    }

    EvidenceEntryV1 {
        string evidenceId PK
        string workspaceId FK
        string correlationId
        string category
        string occurredAtIso
        string hashSha256
        string previousHash
    }

    ArtifactV1 {
        string artifactId PK
        string runId FK
        string evidenceId
        string mimeType
        int sizeBytes
        string storageRef
        string hashSha256
        string createdAtIso
    }

    PolicyV1 {
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
        string adapterId PK
        string workspaceId FK
        string providerSlug
        string portFamily
        bool enabled
    }

    CredentialGrantV1 {
        string credentialGrantId PK
        string workspaceId FK
        string adapterId FK
        string credentialsRef
        string scope
        string issuedAtIso
        string expiresAtIso
        string revokedAtIso
    }

    WorkItemV1 {
        string workItemId PK
        string workspaceId FK
        string title
        string status
        string createdByUserId
        string createdAtIso
        string ownerUserId
    }

    WorkspaceV1 ||--o{ ProjectV1 : contains
    WorkspaceV1 ||--o{ WorkflowV1 : owns
    WorkspaceV1 ||--o{ PolicyV1 : scopes
    WorkspaceV1 ||--o{ AdapterRegistrationV1 : registers
    WorkspaceV1 ||--o{ WorkItemV1 : tracks

    WorkflowV1 ||--|{ WorkflowActionV1 : defines
    WorkflowV1 ||--o{ RunV1 : executes_as

    RunV1 ||--o{ ApprovalV1 : gates
    RunV1 ||--o{ PlanV1 : proposes
    RunV1 ||--o{ EvidenceEntryV1 : records
    RunV1 ||--o{ ArtifactV1 : emits
    EvidenceEntryV1 ||--o{ ArtifactV1 : links_payload

    AdapterRegistrationV1 ||--o{ CredentialGrantV1 : authenticated_by
```

## Notes

- This ERD is intentionally aligned to currently implemented parser contracts (`parse*V1`) rather than aspirational future shapes.
- Cross-object references in canonical types use `ExternalObjectRef` and branded IDs.
- Run lifecycle transition rules are defined in `src/domain/services/run-status-transitions.ts`.
