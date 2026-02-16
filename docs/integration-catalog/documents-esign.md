# Port 15: Documents & E-Signature — Integration Catalog

## Port Operations

- `listDocuments` — Return documents / files filtered by folder, type, owner, or keyword
- `getDocument` — Retrieve a single document by canonical ID or external ref, including metadata
- `uploadDocument` — Upload a new document with file content, name, folder, and metadata
- `deleteDocument` — Delete a document by canonical ID (may move to trash depending on provider)
- `searchDocuments` — Full-text search across document content and metadata with filters
- `createFolder` — Create a new folder / collection within a drive or site
- `listFolders` — Return folders filtered by parent path, owner, or shared status
- `moveDocument` — Move a document to a different folder or site
- `shareDocument` — Create or modify sharing permissions for a document or folder
- `createSignatureRequest` — Initiate a new e-signature envelope / agreement with document and signers
- `getSignatureRequest` — Retrieve signature request status, signer progress, and audit trail
- `listSignatureRequests` — Return signature requests filtered by status, sender, or date range
- `downloadSignedDocument` — Download the completed, signed document with certificate of completion
- `getTemplate` — Retrieve a reusable document or signature template by ID
- `listTemplates` — Return templates filtered by owner, category, or keyword
- `addSigner` — Add a new signer / recipient to an existing signature request
- `voidSignatureRequest` — Cancel an in-progress signature request, notifying all recipients

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider                            | Source                                                                   | Adoption | Est. Customers                         | API Style                                              | Webhooks                                                                 | Key Entities                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------ | -------- | -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DocuSign**                        | S1 — full REST API (eSignature API) with OpenAPI spec, developer sandbox | A1       | ~1.5M+ customers                       | REST (JSON), OAuth 2.0 (Auth Code + JWT)               | Yes — Connect webhooks with envelope event notifications, HMAC signing   | Envelope, Document, Recipient (Signer, CC, Viewer, CertifiedDelivery), Tab (field), Template, PowerForm, BulkSend, Account, User, Brand, Folder, Report |
| **Google Drive**                    | S1 — full REST API v3 with discovery doc, OAuth 2.0                      | A1       | ~3B+ Gmail users, ~10M+ Workspace orgs | REST (JSON), OAuth 2.0                                 | Yes — push notifications via Pub/Sub (changes.watch)                     | File, Folder, Permission, Comment, Reply, Revision, DriveShortcut, SharedDrive, Label, TeamDrive                                                        |
| **Microsoft SharePoint / OneDrive** | S1 — Microsoft Graph API with full docs, developer sandbox tenants       | A1       | Part of Microsoft 365 (~400M+ seats)   | REST (JSON) via Graph API, OAuth 2.0 (delegated + app) | Yes — Graph change notifications (subscriptions) on DriveItems and Lists | DriveItem, Site, List, ListItem, Permission, Subscription, ContentType, Column, Version, Page                                                           |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider                      | Source                                                                | Adoption | Est. Customers                             | API Style                                  | Webhooks                                                              | Key Entities                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------- | -------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Dropbox**                   | S1 — REST API v2 with full docs, app console for dev testing          | A2       | ~700M+ registered users, ~18M+ paying      | REST (JSON), OAuth 2.0                     | Yes — webhook notifications for file/folder changes                   | File, Folder, SharedLink, TeamFolder, Member, Group, Paper, FileRequest, Tag                                                      |
| **Box**                       | S1 — REST API with OpenAPI spec, developer sandbox with free accounts | A2       | ~100k+ businesses                          | REST (JSON), OAuth 2.0 / JWT (server auth) | Yes — webhook subscriptions on file, folder, and collaboration events | File, Folder, Collaboration, Comment, Task, WebLink, Collection, MetadataTemplate, RetentionPolicy, LegalHold, User, Group, Event |
| **Adobe Sign (Acrobat Sign)** | S1 — REST API v6 with full docs, developer sandbox                    | A2       | ~300k+ customers                           | REST (JSON), OAuth 2.0                     | Yes — webhook subscriptions on agreement events                       | Agreement, Document, Participant, Template (LibraryDocument), Workflow, Widget (web form), MegaSign, Group, User, Report          |
| **HelloSign (Dropbox Sign)**  | S1 — REST API with comprehensive docs, test mode                      | A2       | Part of Dropbox ecosystem, ~80k+ customers | REST (JSON), OAuth 2.0 / API key           | Yes — event callbacks with HMAC verification                          | SignatureRequest, Document, Signer, Template, Team, Account, BulkSendJob, UnclaimedDraft                                          |

### Best OSS for Domain Extraction

| Project       | Source                                                         | API Style                                              | Key Entities                                                                                | Notes                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nextcloud** | S1 — self-hosted, WebDAV + OCS REST API, well documented       | REST (JSON) + WebDAV (XML), OAuth 2.0 / app passwords  | File, Folder, Share, User, Group, Tag, Comment, Activity, Version, Trash                    | Leading self-hosted cloud storage and collaboration platform (~400k+ deployments). WebDAV for file operations, OCS API for sharing and user management. Rich plugin ecosystem including e-sign integrations. Good reference for file/folder/permission normalisation. |
| **Minio**     | S1 — self-hosted, S3-compatible REST API                       | S3-compatible REST (XML/JSON), access key / secret key | Object, Bucket, Policy, User, Group, ServiceAccount, Notification, Lifecycle                | High-performance S3-compatible object storage. Pure storage layer without collaboration features. Entities map directly to S3 concepts (Bucket=Folder, Object=File). Good reference for blob storage integration patterns. ~50k GitHub stars.                         |
| **PandaDoc**  | S1 (freemium) — REST API with comprehensive docs, sandbox mode | REST (JSON), OAuth 2.0 / API key                       | Document, Template, Recipient, Folder, Contact, Catalog, PricingTable, Form, ContentLibrary | Document automation and e-signature platform bridging both domains. Unique entities like PricingTable and Catalog support proposal/quote workflows. Good reference for template-driven document generation combined with e-signature.                                 |

### Tier A3 — Established Niche

| Provider               | Source                                                  | Adoption | Notes                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zoho Sign**          | S1 — REST API with OAuth 2.0, part of Zoho ecosystem    | A3       | SMB e-signature platform integrated with Zoho suite. Entities: Request, Document, Action (signer event), Template, Folder, Field, User. Strong in price-sensitive and Zoho-ecosystem customers.                                                                  |
| **SignNow (airSlate)** | S1 — REST API with OAuth 2.0, sandbox environment       | A3       | SMB-focused e-signature with document workflow automation. Part of airSlate business automation suite. Entities: Document, Invite, Field, Template, Folder, User, Team, Role. Competitive pricing for high-volume signing.                                       |
| **Egnyte**             | S2 — REST API with some endpoint gaps in newer features | A3       | Enterprise content governance and file sharing. ~16k+ customers. Entities: File, Folder, Permission, Link, User, Group, AuditEvent, Lock, Metadata. Strong in regulated industries (finance, healthcare, life sciences) with compliance and governance features. |

### Tier A4 — Emerging / Regional

| Provider        | Source                                  | Adoption | Notes                                                                                                                                                                                                      |
| --------------- | --------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **eversign**    | S1 — REST API with straightforward docs | A4       | Lightweight e-signature tool for SMBs and freelancers. Entities: Document, Signer, Template, File, Log. Simple API with fast integration time. Limited advanced features (no bulk send, limited workflow). |
| **SignRequest** | S1 — REST API with OAuth 2.0            | A4       | EU-based e-signature provider. Entities: Document, Signer, Template, Team, Event. Focused on European compliance (eIDAS). Acquired by Box in 2021; API may evolve toward Box Sign.                         |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by document and e-signature domain.

### Documents & Storage

- **Document / File / Object** — The primary content record: a stored file with binary content and metadata (Document in DocuSign/Adobe Sign/PandaDoc, File in Google Drive/Dropbox/Box/Nextcloud, Object in Minio, DriveItem in SharePoint/OneDrive)
- **Folder / Bucket / Collection** — A container for organising documents hierarchically (Folder in most providers, Bucket in Minio, Collection in Box, SharedDrive/TeamDrive in Google Drive, Site in SharePoint)
- **Version / Revision** — A historical snapshot of a document's content at a point in time (Revision in Google Drive, Version in SharePoint/Nextcloud/Box)
- **WebLink / SharedLink** — A URL providing external access to a document with optional expiry and permissions (SharedLink in Dropbox/Box, Permission link in Google Drive, FileRequest in Dropbox)
- **Trash** — Soft-deleted documents awaiting permanent removal (Trash in Nextcloud, Trash in Google Drive, RecycleBin in SharePoint)

### Permissions & Sharing

- **Permission / Collaboration / Share** — An access control entry granting a user or group rights to a document or folder (Permission in Google Drive/SharePoint/Egnyte, Collaboration in Box, Share in Nextcloud)
- **User / Member** — A person within the document management system (User in all providers, Member in Dropbox/Google Drive teams)
- **Group / Team** — A named group of users for bulk permission assignment (Group in Box/Nextcloud/Minio/Egnyte, Team in Dropbox/HelloSign)

### Annotations & Collaboration

- **Comment / Annotation / Reply** — A discussion entry or markup on a document (Comment in Google Drive/Box/Nextcloud, Reply in Google Drive, Annotation in PDF-centric tools)
- **Tag / Label / Metadata** — Classification or custom metadata applied to documents (Tag in Dropbox/Nextcloud, Label in Google Drive, MetadataTemplate in Box, Metadata in Egnyte)
- **Activity / Event / AuditTrail** — A log entry recording actions performed on a document (Activity in Nextcloud, Event in Box, AuditEvent in Egnyte, Report in DocuSign/Adobe Sign)

### E-Signature Core

- **Envelope / Agreement / SignatureRequest** — The top-level signing transaction containing documents and recipients (Envelope in DocuSign, Agreement in Adobe Sign, SignatureRequest in HelloSign, Request in Zoho Sign, Document in SignNow/eversign/SignRequest)
- **Signer / Recipient / Participant** — A person required to sign, approve, or receive a copy of the document (Recipient in DocuSign with sub-types: Signer, CC, Viewer, CertifiedDelivery; Participant in Adobe Sign; Signer in HelloSign/PandaDoc/eversign/SignRequest)
- **Tab / Field / FormField** — A signature, initial, date, or text field placed on a document for signers to complete (Tab in DocuSign, Field in Adobe Sign/SignNow/Zoho Sign, FormField in PandaDoc)
- **Template / LibraryDocument** — A reusable document with predefined fields and recipient roles (Template in most providers, LibraryDocument in Adobe Sign, ContentLibrary in PandaDoc)

### E-Signature Extended

- **PowerForm / Widget** — A self-service signing URL that recipients can access without an explicit send (PowerForm in DocuSign, Widget in Adobe Sign, Form in PandaDoc)
- **BulkSend / MegaSign / BulkSendJob** — A batch signing operation sending the same document to many recipients (BulkSend in DocuSign, MegaSign in Adobe Sign, BulkSendJob in HelloSign)
- **UnclaimedDraft** — A signature request created via API but not yet finalised or sent (UnclaimedDraft in HelloSign)
- **Brand / Branding** — Custom branding (logo, colours) applied to the signing experience (Brand in DocuSign)

### Governance & Compliance

- **RetentionPolicy** — A rule governing how long documents are retained before deletion (RetentionPolicy in Box)
- **LegalHold** — A preservation order preventing document deletion during litigation (LegalHold in Box)
- **ContentType / MetadataTemplate** — A schema definition for document classification and metadata (ContentType in SharePoint, MetadataTemplate in Box)
- **Lifecycle** — An automated rule for transitioning or expiring objects based on age or status (Lifecycle in Minio)
- **Site / SharedDrive** — A top-level organisational container for document libraries (Site in SharePoint, SharedDrive in Google Drive)

---

## VAOP Canonical Mapping

| Universal Entity                        | VAOP Canonical Object         | Mapping Notes                                                                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Document / File / Object                | `Document`                    | Direct mapping. File metadata (name, size, MIME type, owner, created/modified dates) normalised. Binary content referenced by provider URL or VAOP storage key. A `document_source` attribute distinguishes storage files from e-sign documents. |
| Folder / Bucket / Collection            | `ExternalObjectRef`           | Folder hierarchy varies by provider (nested paths vs. flat with parent refs). Stored as external references with path metadata. Documents link to their parent folder ref.                                                                       |
| Permission / Collaboration / Share      | `ExternalObjectRef`           | Access control models differ significantly (ACL vs. role-based vs. link-based). Stored as external references with permission type (read/write/admin), grantee, and scope metadata.                                                              |
| Version / Revision                      | `ExternalObjectRef`           | Document history snapshots. Stored as external references linked to the parent Document with version number, author, and timestamp.                                                                                                              |
| Comment / Annotation / Reply            | `ExternalObjectRef`           | Document-scoped discussion entries. Stored as external references linked to parent Document with author and position metadata.                                                                                                                   |
| Template / LibraryDocument              | `Document` (type: `template`) | Reusable document templates mapped to Document with `type: template`. Field definitions, recipient roles, and layout preserved in structured metadata. Shared across the template and e-sign sub-domains.                                        |
| Envelope / Agreement / SignatureRequest | `ExternalObjectRef`           | The top-level signing transaction. Stored as typed external references with status (sent, delivered, completed, voided), creation date, and expiry. Links to child Document(s) and Signer Party records.                                         |
| Signer / Recipient / Participant        | `Party` (role: `signer`)      | Mapped to Party with signer role. Name, email, signing order, and status (pending, signed, declined) normalised. Multiple signers per envelope create multiple Party records linked to the same ExternalObjectRef.                               |
| Tab / Field / FormField                 | `ExternalObjectRef`           | Signature and form fields placed on documents. Stored as external references with field type (signature, initial, date, text), position coordinates, and assigned signer. Linked to parent Envelope ref.                                         |
| User / Member                           | `Party` (role: `employee`)    | System users mapped to Party with employee role. Display name, email, and role normalised. Distinguished from Signer (external party) by role.                                                                                                   |
| Group / Team                            | `ExternalObjectRef`           | User groupings for permission management. Stored as external references with membership metadata.                                                                                                                                                |
| Tag / Label / Metadata                  | `ExternalObjectRef`           | Classification labels and custom metadata applied to documents. Stored as external references with key-value metadata pairs.                                                                                                                     |
| Activity / Event / AuditTrail           | `ExternalObjectRef`           | Audit log entries recording document and envelope actions. Stored as external references with event type, actor, timestamp, and IP address where available.                                                                                      |
| RetentionPolicy                         | `ExternalObjectRef`           | Governance rules for document lifecycle. Stored as external references with retention duration, scope, and action (archive, delete) metadata.                                                                                                    |
| LegalHold                               | `ExternalObjectRef`           | Litigation preservation orders. Stored as external references with hold name, custodian, and affected document/folder scope.                                                                                                                     |
| Site / SharedDrive                      | `ExternalObjectRef`           | Top-level organisational containers for document libraries. Stored as external references; child folders and documents link upward via hierarchy metadata.                                                                                       |
| WebLink / SharedLink                    | `ExternalObjectRef`           | External sharing URLs with access controls. Stored as external references with link URL, expiry, password protection, and permission level.                                                                                                      |
| Brand / Branding                        | `ExternalObjectRef`           | Custom signing experience branding. Stored as external references with logo URL, colour scheme, and display name metadata.                                                                                                                       |
| ContentType / MetadataTemplate          | `ExternalObjectRef`           | Schema definitions for document classification. Stored as external references with field definitions and validation rules.                                                                                                                       |
| BulkSend / MegaSign                     | `ExternalObjectRef`           | Batch signing operations. Stored as external references linked to the source Template and containing per-recipient status tracking.                                                                                                              |

---

## Notes

- **DocuSign** dominates the e-signature market and should be the first adapter implemented for the signing sub-domain of Port 15. Its Envelope→Document→Recipient→Tab hierarchy is the de facto standard model.
- **Google Drive** and **SharePoint/OneDrive** cover the majority of cloud document storage and should be the first adapters for the storage sub-domain. Together they represent the two major enterprise productivity ecosystems.
- Port 15 spans two distinct sub-domains — document storage/management and e-signature — that share the `Document` canonical but have different operational patterns. Consider separate sub-adapter interfaces for storage operations (CRUD, sharing, search) vs. signing operations (create request, add signer, void).
- **Box** is notable for its governance features (RetentionPolicy, LegalHold, MetadataTemplate) which are important for regulated industries. These entities are mapped as external references but may warrant dedicated canonicals if governance becomes a primary use case.
- **PandaDoc** bridges both sub-domains with document generation and e-signature in a single platform. Its Catalog and PricingTable entities are unique and relevant for quote/proposal workflows that may intersect with Port 8 (Finance & Accounting).
- The `Signer` Party role is distinct from the `employee` role used for system users. A signer is typically an external party (customer, vendor, counterparty) who receives a document for signature. The same person may exist as both an employee Party (internal user) and a signer Party (external recipient) in different contexts.
- Signed documents should be stored as immutable `Document` records with a reference back to the originating Envelope/Agreement `ExternalObjectRef`, preserving the full audit chain from request through completion.
