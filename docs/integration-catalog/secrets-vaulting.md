# Port 10: Secrets & Vaulting — Integration Catalog

## Port Operations

| Operation           | Description                                                             | Idempotent |
| ------------------- | ----------------------------------------------------------------------- | ---------- |
| `getSecret`         | Retrieve a secret value by path or canonical ID                         | Yes        |
| `putSecret`         | Create or update a secret at a given path                               | No         |
| `deleteSecret`      | Permanently or soft-delete a secret                                     | No         |
| `listSecrets`       | List secret metadata (not values) with optional path prefix filter      | Yes        |
| `rotateSecret`      | Trigger immediate rotation of a secret according to its rotation config | No         |
| `createCertificate` | Issue a new certificate from the configured PKI backend                 | No         |
| `getCertificate`    | Retrieve a certificate and its chain by ID or common name               | Yes        |
| `renewCertificate`  | Renew an existing certificate before expiry                             | No         |
| `listCertificates`  | List certificates with filter by status, expiry window, or issuer       | Yes        |
| `encrypt`           | Encrypt a plaintext payload using a named key                           | Yes        |
| `decrypt`           | Decrypt a ciphertext payload using a named key                          | Yes        |
| `createKey`         | Create a new encryption key in the key-management backend               | No         |
| `listKeys`          | List available encryption keys with metadata                            | Yes        |
| `getAuditLog`       | Retrieve audit log entries filtered by time range, principal, or action | Yes        |
| `setSecretPolicy`   | Apply or update an access policy governing a secret path or key         | No         |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider                         | Source                                                                   | Adoption | Est. Customers                                                           | API Style                      | Webhooks                                                        | Key Entities                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HashiCorp Vault** (Enterprise) | S1 — full REST API with OpenAPI spec, public sandbox via dev-mode server | A1       | ~30 k+ enterprise customers; dominant in cloud-native secrets management | REST (JSON), mTLS & token auth | No native webhooks — audit log streaming via syslog/file/socket | Secret (KV v1/v2), SecretEngine, Policy (HCL/JSON), Token, AuthMethod, AuditDevice, Lease, Certificate (PKI engine), Key (Transit engine), Identity (Entity, Alias, Group) |
| **AWS Secrets Manager**          | S1 — AWS SDK with OpenAPI-derived specs, sandbox via free-tier accounts  | A1       | Millions of AWS customers; tightly integrated with Lambda, RDS, ECS      | REST via AWS SDK (Sigv4 auth)  | Yes — EventBridge events on rotation, deletion, access          | Secret, SecretVersion (staging labels: AWSCURRENT/AWSPREVIOUS), RotationConfig (Lambda ARN + schedule), ResourcePolicy (IAM JSON), ReplicaRegion                           |
| **AWS KMS**                      | S1 — AWS SDK, full OpenAPI spec, sandbox via free-tier                   | A1       | Ubiquitous across AWS; underpins S3 SSE, EBS, RDS encryption             | REST via AWS SDK (Sigv4 auth)  | Yes — CloudTrail events for all key operations                  | Key (symmetric/asymmetric/HMAC), Alias, Grant, KeyPolicy (IAM JSON), CustomKeyStore (CloudHSM-backed)                                                                      |

### Tier A2 — Strong Contenders (10–30 % share or >10 k customers)

| Provider                           | Source                                                                    | Adoption | Est. Customers                                                                       | API Style                                       | Webhooks                                                     | Key Entities                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Azure Key Vault**                | S1 — full REST API with OpenAPI specs, sandbox via free Azure accounts    | A2       | Hundreds of thousands of Azure customers use Key Vault; standard for Azure workloads | REST (JSON), Azure AD OAuth 2.0                 | Yes — Event Grid events for key/secret/certificate lifecycle | Secret, Key, Certificate, AccessPolicy, ManagedStorageAccount, DeletedSecret (soft-delete), Backup (blob) |
| **Google Cloud Secret Manager**    | S1 — REST and gRPC with full client libraries, sandbox via GCP free tier  | A2       | Broad GCP adoption; ~10 k+ active projects using Secret Manager                      | REST / gRPC, IAM-based auth                     | Yes — Pub/Sub notifications on secret version state changes  | Secret, SecretVersion, Topic (Pub/Sub notification config), IAMPolicy                                     |
| **Google Cloud KMS**               | S1 — REST API with OpenAPI spec, client libraries for all major languages | A2       | Integral to GCP encryption; used alongside BigQuery, GCS, GKE                        | REST (JSON), IAM-based auth                     | Yes — Cloud Audit Logs via Pub/Sub                           | KeyRing, CryptoKey, CryptoKeyVersion, ImportJob                                                           |
| **CyberArk Conjur**                | S1 — full REST API with OpenAPI spec, OSS version available for dev       | A2       | ~7 k+ enterprise customers across CyberArk product family; strong in PAM             | REST (JSON), token/API-key auth                 | No native webhooks — audit log export via syslog             | Secret, Variable, Policy (YAML-based), Resource, Role, Host, HostFactory, Authenticator                   |
| **1Password** (Business / Connect) | S1 — 1Password Connect REST API with OpenAPI spec                         | A2       | ~150 k+ business customers; rapidly growing developer-tools adoption                 | REST (JSON), bearer token auth (Connect Server) | No native webhooks — Events API for polling audit events     | Vault, Item, ItemField, File (document attachment), ServiceAccount, Group, User                           |

### Best OSS for Domain Extraction

| Project                                 | Source                                                                   | API Style      | Key Entities                                                                                                    | Notes                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HashiCorp Vault** (Community Edition) | S1 — identical REST API to Enterprise; dev-mode server for local testing | REST (JSON)    | Secret, SecretEngine, Policy, Token, AuthMethod, AuditDevice, Lease, Certificate (PKI), Key (Transit), Identity | Full-featured open-source vault. Same API surface as Enterprise minus governance features (namespaces, Sentinel, replication). ~30 k GitHub stars. Best reference implementation for secrets-domain entity modelling. |
| **Infisical**                           | S1 — REST API with OpenAPI spec, self-hosted or cloud                    | REST (JSON)    | Secret, Workspace, Environment, Folder, SecretVersion, ServiceToken, Integration (sync to third-party)          | Developer-first secrets manager. ~15 k GitHub stars. Clean REST API with environment-scoped secrets. Good model for workspace-oriented multi-tenancy.                                                                 |
| **SOPS** (Mozilla)                      | S4 — CLI tool, no HTTP API; file-based encryption/decryption             | CLI / file I/O | EncryptedFile, Key (PGP, AWS KMS, GCP KMS, Azure Key Vault, age)                                                | Encrypts structured files (YAML, JSON, ENV, INI) in-place. ~16 k GitHub stars. No server component — adapter would invoke CLI or use Go library. Useful for GitOps secret workflows.                                  |
| **Doppler**                             | S1 — REST API with OpenAPI spec, CLI, and SDKs                           | REST (JSON)    | Secret, Project, Environment, Config, ServiceToken, AuditLog, Integration                                       | SaaS-native secrets manager with strong developer UX. Growing OSS community. Clean project/environment/config hierarchy maps well to VAOP workspace model.                                                            |

### Tier A3 — Established Niche

| Provider                        | Source                                                                        | Adoption | Notes                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delinea** (formerly Thycotic) | S2 — REST API with some gaps; Secret Server and DevOps Secrets Vault products | A3       | Enterprise PAM vendor with secrets management capabilities. Entities: Secret, Folder, SecretTemplate, User, Role, Policy. Strong in regulated industries (finance, healthcare). API coverage is good for Secret Server but DevOps Secrets Vault API is newer and less mature. |
| **Akeyless**                    | S1 — full REST API with OpenAPI spec, SaaS-native architecture                | A3       | SaaS-native vault with zero-knowledge encryption (DFC patent). Entities: Secret, DynamicSecret, RotatedSecret, AuthMethod, Role, Target, Gateway. Growing in cloud-native enterprises. Clean API but smaller ecosystem than Vault.                                            |

### Tier A4 — Emerging / Niche

| Provider             | Source                                                                | Adoption | Notes                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keywhiz** (Square) | S3 — Java-based, community-maintained REST API, limited documentation | A4       | Square's internal secrets manager open-sourced. Entities: Secret, Group, Client, Membership. Limited adoption outside Square. ~2.6 k GitHub stars. Java-only; no official SDKs for other languages. |
| **Knox** (Pinterest) | S3 — Go-based, limited community and documentation                    | A4       | Pinterest's internal key management system. Entities: Key, KeyVersion, Access, Machine. Minimal community adoption. ~1.1 k GitHub stars. Interesting rotation model but essentially unmaintained.   |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by secrets-management domain.

### Secret Storage

| Entity                     | Description                                                                     | Observed In                                                       |
| -------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Secret**                 | A named secret value (password, API key, connection string, credential)         | All providers                                                     |
| **SecretVersion**          | An immutable version/revision of a secret value                                 | Vault (KV v2), AWS Secrets Manager, GCP Secret Manager, Infisical |
| **SecretEngine / Backend** | A pluggable storage or generation backend for secrets (KV, database, SSH, etc.) | Vault                                                             |
| **EncryptedValue**         | A ciphertext blob produced by encryption-as-a-service operations                | Vault (Transit), AWS KMS, Azure Key Vault, GCP KMS                |
| **EncryptedFile**          | A file with encrypted content (YAML, JSON, ENV)                                 | SOPS                                                              |

### Key Management

| Entity                                  | Description                                                                          | Observed In                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **Key** (symmetric / asymmetric / HMAC) | A cryptographic key used for encryption, signing, or MAC operations                  | Vault (Transit), AWS KMS, Azure Key Vault, GCP KMS |
| **KeyRing**                             | A logical grouping of cryptographic keys within a project and location               | GCP KMS                                            |
| **CryptoKeyVersion**                    | A specific version of a cryptographic key, with state (enabled, disabled, destroyed) | GCP KMS                                            |
| **Alias**                               | A human-friendly name that points to a key                                           | AWS KMS                                            |
| **ImportJob**                           | A mechanism for importing externally generated key material                          | GCP KMS, AWS KMS                                   |
| **CustomKeyStore**                      | A key store backed by external HSM infrastructure (e.g., CloudHSM)                   | AWS KMS                                            |

### PKI & Certificates

| Entity          | Description                                                                | Observed In                         |
| --------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| **Certificate** | An X.509 certificate with subject, issuer, validity, and key material      | Vault (PKI engine), Azure Key Vault |
| **PKI / CA**    | A certificate authority configuration for issuing and signing certificates | Vault (PKI engine)                  |

### Access & Policy

| Entity                                    | Description                                                                  | Observed In                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Policy**                                | An access-control policy governing read/write/delete on secret paths or keys | Vault (HCL), CyberArk (YAML), AWS (IAM JSON), Azure (Access Policy), GCP (IAM) |
| **Token / ServiceToken / ServiceAccount** | An authentication credential granting programmatic access to the vault       | Vault, Infisical, Doppler, 1Password (Connect token)                           |
| **Grant / Permission**                    | A fine-grained permission delegation for a specific key or resource          | AWS KMS (Grant), CyberArk (Role), Azure (RBAC)                                 |
| **AuthMethod / Authenticator**            | A pluggable authentication backend (LDAP, OIDC, AppRole, Kubernetes, etc.)   | Vault, CyberArk Conjur, Akeyless                                               |
| **Identity / Entity**                     | A canonical identity that may have multiple auth-method aliases              | Vault (Identity engine)                                                        |

### Audit & Lifecycle

| Entity                        | Description                                                                    | Observed In                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **AuditLog / AuditEvent**     | A record of who accessed or modified a secret, key, or policy                  | Vault, AWS (CloudTrail), Azure (Activity Log), GCP (Cloud Audit Logs), Doppler, 1Password |
| **AuditDevice**               | A configured audit backend (file, syslog, socket) for streaming audit events   | Vault                                                                                     |
| **Lease / TTL**               | A time-bound grant on a dynamically generated secret or token                  | Vault                                                                                     |
| **RotationConfig / Schedule** | Configuration governing automatic secret rotation (schedule, Lambda ARN, etc.) | AWS Secrets Manager, Akeyless                                                             |
| **Backup / Snapshot**         | A point-in-time backup of the vault's encrypted data                           | Vault (Raft snapshots), Azure Key Vault (backup blobs)                                    |

### Organisation

| Entity                             | Description                                                 | Observed In                                                            |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Vault / KeyStore**               | A logical container or namespace for secrets and keys       | 1Password (Vault), Azure Key Vault (vault instance), Vault (namespace) |
| **Workspace**                      | A project-level container for secrets scoped by environment | Infisical                                                              |
| **Project / Environment / Config** | Hierarchical organisational units for grouping secrets      | Doppler, Infisical                                                     |
| **Folder**                         | A path-based organisational unit within a secret store      | Infisical, Delinea (Secret Server)                                     |

---

## VAOP Canonical Mapping

| Universal Entity             | VAOP Canonical Object | Mapping Notes                                                                                                                                                                                        |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret                       | `ExternalObjectRef`   | Secrets are infrastructure primitives, not business entities. VAOP references them via `CredentialGrant` in the Workspace aggregate. The secret value itself is never stored in VAOP's domain model. |
| SecretVersion                | `ExternalObjectRef`   | Version metadata stored as typed reference with staging label and creation timestamp.                                                                                                                |
| Key (symmetric / asymmetric) | `ExternalObjectRef`   | Key metadata (algorithm, state, creation date) stored as external reference. Key material never leaves the vault.                                                                                    |
| Certificate                  | `ExternalObjectRef`   | Certificate metadata (subject, issuer, expiry, serial) stored as reference. VAOP may monitor expiry for alerting.                                                                                    |
| Vault / KeyStore             | `ExternalObjectRef`   | The vault instance or namespace. Referenced by VAOP Workspace configuration.                                                                                                                         |
| Policy                       | `ExternalObjectRef`   | Access policies are vault-native and vary significantly across providers. Stored as opaque reference with policy name and path.                                                                      |
| Token / ServiceToken         | `ExternalObjectRef`   | Tokens are ephemeral authentication credentials. VAOP stores only the token accessor or ID, never the token value. Maps to `CredentialGrant` in the Workspace aggregate.                             |
| AuditLog / AuditEvent        | `ExternalObjectRef`   | Audit events are read-only and provider-specific in schema. Stored as typed references for compliance queries.                                                                                       |
| AuthMethod / Authenticator   | `ExternalObjectRef`   | Authentication backend configuration. Referenced in VAOP adapter connection settings.                                                                                                                |
| Lease / TTL                  | `ExternalObjectRef`   | Lease metadata (ID, TTL, renewable flag) stored for lifecycle management.                                                                                                                            |
| RotationConfig               | `ExternalObjectRef`   | Rotation schedule and target configuration. VAOP may use this to trigger or monitor rotation workflows.                                                                                              |
| Grant / Permission           | `ExternalObjectRef`   | Fine-grained permission grants. Stored as reference with grantee and allowed operations.                                                                                                             |
| Backup / Snapshot            | `ExternalObjectRef`   | Backup metadata (timestamp, size, status). VAOP does not manage backup content.                                                                                                                      |
| PKI / CA                     | `ExternalObjectRef`   | CA configuration metadata. Referenced when issuing certificates through VAOP port operations.                                                                                                        |
| Identity / Entity            | `ExternalObjectRef`   | Vault-native identity records. Not mapped to `Party` because these represent machine identities and auth aliases, not business parties.                                                              |
| EncryptedValue               | —                     | Transient; returned inline from `encrypt`/`decrypt` operations. Not persisted as a standalone entity in VAOP.                                                                                        |

---

## Notes

- **Secrets and vaulting entities are almost entirely infrastructure-level** and do not map to VAOP's business canonical objects (Party, Invoice, Payment, etc.). VAOP's primary interaction with this port is through the `CredentialGrant` entity in the Workspace aggregate, which holds the metadata needed to authenticate adapter connections to external SoRs.
- **HashiCorp Vault** should be the first adapter implemented given its dominant market position and the fact that both the OSS and Enterprise editions share the same API surface.
- **AWS Secrets Manager + AWS KMS** should be the second priority, as they are the default choice for AWS-native organisations and cover both secret storage and key management.
- The `encrypt` / `decrypt` port operations enable VAOP to offer encryption-as-a-service without ever handling raw key material — the actual cryptographic operations are delegated to the vault backend (Vault Transit, AWS KMS, Azure Key Vault, GCP KMS).
- SOPS is included in the OSS catalog despite being file-based (S4) because it is widely used in GitOps workflows and may be relevant for VAOP's own configuration encryption needs.
