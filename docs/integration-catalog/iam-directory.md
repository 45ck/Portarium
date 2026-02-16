# Port 9: IAM & Directory — Integration Catalog

## Port Operations

| Operation             | Description                                                          | Idempotent |
| --------------------- | -------------------------------------------------------------------- | ---------- |
| `listUsers`           | Return directory users filtered by status, group, role, or attribute | Yes        |
| `getUser`             | Retrieve a single user by canonical ID, email, or external ref       | Yes        |
| `createUser`          | Provision a new user with profile attributes and group memberships   | No         |
| `updateUser`          | Modify user profile attributes, status, or group memberships         | No         |
| `deactivateUser`      | Suspend or deactivate a user account without deletion                | No         |
| `listGroups`          | Return groups filtered by type, membership count, or name prefix     | Yes        |
| `getGroup`            | Retrieve a single group with its membership list                     | Yes        |
| `createGroup`         | Create a new group with name, description, and initial members       | No         |
| `addUserToGroup`      | Add a user to a group membership                                     | No         |
| `removeUserFromGroup` | Remove a user from a group membership                                | No         |
| `listRoles`           | Return available roles filtered by scope or application              | Yes        |
| `assignRole`          | Grant a role to a user or group with optional scope constraints      | No         |
| `revokeRole`          | Remove a role assignment from a user or group                        | No         |
| `listApplications`    | Return registered applications filtered by SSO protocol or status    | Yes        |
| `getApplication`      | Retrieve application details including SSO configuration             | Yes        |
| `authenticateUser`    | Validate user credentials and return an authentication assertion     | No         |
| `verifyMFA`           | Verify a multi-factor authentication challenge response              | No         |
| `listAuditLogs`       | Return audit/event logs filtered by user, action, date, or severity  | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider                                   | Source                                                                                 | Adoption | Est. Customers                                              | API Style                                | Webhooks                                                                                      | Key Entities                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Microsoft Entra ID** (formerly Azure AD) | S1 — Microsoft Graph REST API with OpenAPI spec, developer tenants available           | A1       | ~720M+ monthly active users across enterprise and education | REST (Microsoft Graph), OAuth 2.0 / OIDC | Yes — change notifications via Graph subscriptions (webhooks), Event Hubs for audit streaming | User, Group, Application, ServicePrincipal, DirectoryRole, Device, Domain, AuditLog, SignInLog, ConditionalAccessPolicy, OAuth2PermissionGrant    |
| **Okta**                                   | S1 — REST API with OpenAPI spec, developer sandbox (free), comprehensive SDK ecosystem | A1       | ~18k+ paying customers (dominant independent IdP)           | REST (JSON), OAuth 2.0 / OIDC            | Yes — Event Hooks (webhooks), System Log streaming via API                                    | User, Group, Application, AppUser (assignment), Factor (MFA), Session, Role, AuthorizationServer, Policy, Rule, NetworkZone, EventHook, SystemLog |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider                              | Source                                                             | Adoption | Est. Customers                                                                 | API Style                     | Webhooks                                                                    | Key Entities                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Google Workspace** (Cloud Identity) | S1 — Admin SDK REST API, Directory API, cloud-based test domains   | A2       | ~9M+ paying businesses (Google Workspace), Cloud Identity available standalone | REST (JSON), OAuth 2.0        | Yes — push notifications via Admin SDK, Google Cloud Pub/Sub for audit logs | User, Group, OrgUnit, Role, RoleAssignment, Domain, Device, Token, AuditActivity                                |
| **JumpCloud**                         | S1 — REST API v1/v2 with comprehensive docs, free tier for testing | A2       | ~200k+ organisations (strong in SMB directory-as-a-service)                    | REST (JSON), API key auth     | Yes — webhook integrations, Directory Insights API for event streaming      | SystemUser, UserGroup, System, SystemGroup, Application, Command, Policy, Directory (LDAP/RADIUS), RadiusServer |
| **OneLogin**                          | S1 — REST API with developer documentation, sandbox environments   | A2       | ~5.5k+ customers (mid-market SSO and directory)                                | REST (JSON), OAuth 2.0        | Yes — event webhooks, Smart Hooks (inline webhooks for auth flows)          | User, Group, Role, App, Event, SAMLAssertion, Policy, CustomAttribute, Privilege                                |
| **Ping Identity** (PingOne)           | S2 — REST API with moderate documentation; sandbox by license      | A2       | ~3k+ enterprise customers (strong in large enterprise and banking)             | REST (JSON), OAuth 2.0 / OIDC | Limited — PingOne webhook notifications available for select events         | User, Group, Application, Population, Role, Schema, IdentityProvider, MFAPolicy, SignOnPolicy                   |

### Best OSS for Domain Extraction

| Project       | Source                                                                 | API Style   | Key Entities                                                                                                                         | Notes                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keycloak**  | S1 — self-hosted, comprehensive Admin REST API with OpenAPI spec       | REST (JSON) | User, Group, Role (realm/client), Client (Application), Realm, IdentityProvider, AuthenticationFlow, Session, Event, Scope, Resource | Red Hat-backed open-source IAM (~24k GitHub stars). OIDC/SAML compliant. Multi-realm architecture provides excellent reference for tenant-scoped identity modelling. Rich admin API covers full user lifecycle, role management, and federation. |
| **FreeIPA**   | S2 — JSON-RPC API over HTTPS; comprehensive but non-standard interface | JSON-RPC    | User, Group, Host, HostGroup, Role, Permission, Service, SudoRule, HBACRule                                                          | Red Hat-backed open-source identity management for Linux/UNIX environments (~1.2k GitHub stars). Integrates LDAP, Kerberos, DNS, and certificate management. Good reference for POSIX user/group modelling and host-based access control.        |
| **Authentik** | S1 — self-hosted, well-documented REST API with OpenAPI spec           | REST (JSON) | User, Group, Application, Provider (OIDC/SAML/LDAP/Proxy), Flow, Stage, Policy, Token, PropertyMapping                               | Modern open-source identity provider (~14k GitHub stars). Flow-based authentication engine provides flexible auth pipeline modelling. Excellent developer experience and API design. Good reference for policy-driven access decisions.          |

### Tier A3 — Established Niche

| Provider                                  | Source                                                               | Adoption | Notes                                                                                                                                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth0** (by Okta)                       | S1 — REST Management API with sandbox tenants and comprehensive SDKs | A3       | Developer-focused identity platform. ~22k customers before Okta acquisition. Entities: User, Connection, Client (App), Role, Permission, Organization, Log, Action, Rule (deprecated), Hook. Best-in-class developer experience; strong in B2C and SaaS use cases. |
| **CyberArk Identity** (formerly Idaptive) | S2 — REST API with moderate documentation; PAM focus                 | A3       | Enterprise privileged access management with SSO and directory. Entities: User, Role, Application, Policy, DirectoryService, Vault, Account, Session, AuditEvent. Strong in highly regulated industries (finance, healthcare).                                     |

### Tier A4 — Emerging / Regional

| Provider       | Source                                                          | Adoption | Notes                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zitadel**    | S1 — gRPC and REST API with OpenAPI spec, cloud and self-hosted | A4       | Open-source-first identity management (~9k GitHub stars). Entities: User (Human/Machine), Organization, Project, Application, Role, Grant, Action, Session, Event. Event-sourced architecture provides complete audit trail. Strong in European market with GDPR-first design.          |
| **FusionAuth** | S1 — REST API with comprehensive docs, free community edition   | A4       | Developer-focused IAM with self-hosted and cloud options (~13k GitHub stars). Entities: User, Application, Group, Role, Registration, Tenant, Lambda, Webhook, AuditLog, Key, Theme. Strong in SaaS and multi-tenant applications. Free tier includes all features (no feature gating). |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by IAM domain.

### Identity & Profile

| Entity                      | Description                                                                                | Observed In                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **User**                    | A human or machine identity with profile attributes and credentials                        | All providers (User everywhere; SystemUser in JumpCloud; Human/Machine distinction in Zitadel)                   |
| **Group**                   | A collection of users for access management, policy assignment, or organisational grouping | All providers (Group universally; UserGroup in JumpCloud; SecurityGroup vs. Microsoft 365 Group in Entra ID)     |
| **Domain / Realm / Tenant** | A top-level identity boundary or namespace for multi-tenancy                               | Entra ID (Domain), Keycloak (Realm), Okta (Org), Authentik (Tenant), FusionAuth (Tenant), Zitadel (Organization) |
| **DirectoryOU / OrgUnit**   | An organisational unit for hierarchical user/group structure                               | Entra ID (AdministrativeUnit), Google Workspace (OrgUnit), FreeIPA (implicit in LDAP tree)                       |
| **Schema / Attribute**      | Custom attribute definitions extending the user or group profile                           | Okta (Schema), Ping Identity (Schema), Entra ID (extensionProperty), OneLogin (CustomAttribute)                  |

### Applications & Access

| Entity                                | Description                                                             | Observed In                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Application / Client**              | A registered application or service that users can authenticate to      | All providers (Application in Okta/Entra ID/JumpCloud, Client in Keycloak/Auth0, App in OneLogin/Authentik) |
| **ServicePrincipal / ServiceAccount** | A non-human identity representing an application or service             | Entra ID (ServicePrincipal), Google Workspace (ServiceAccount), Keycloak (service account Users)            |
| **Role**                              | A named set of permissions assignable to users or groups                | All providers (DirectoryRole in Entra ID, Role in Okta/Keycloak/Auth0, RoleAssignment in Google)            |
| **Permission / Scope**                | A granular access right or OAuth scope granted to a user or application | Keycloak (Scope/Resource), Auth0 (Permission), FreeIPA (Permission), Entra ID (OAuth2PermissionGrant)       |
| **OAuth2Grant**                       | A delegated permission consent linking a user, application, and scope   | Entra ID (OAuth2PermissionGrant), Okta (Grant), Keycloak (consent)                                          |

### Authentication & MFA

| Entity                           | Description                                                                      | Observed In                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Session**                      | An active authentication session with expiry and device metadata                 | Okta (Session), Keycloak (Session), Entra ID (signInActivity), Zitadel (Session)                    |
| **Factor / MFA**                 | A multi-factor authentication method enrolled by a user (TOTP, SMS, FIDO2, push) | Okta (Factor), Entra ID (authenticationMethods), Ping Identity (MFAPolicy), Keycloak (credential)   |
| **Token**                        | An OAuth/OIDC token, API key, or refresh token issued to a user or application   | Google Workspace (Token), Authentik (Token), FusionAuth (RefreshToken), Keycloak (offline sessions) |
| **IdentityProvider (SAML/OIDC)** | A federated identity provider configuration for SSO (upstream IdP)               | Keycloak, Authentik, Okta (Identity Provider), Entra ID (Identity Provider), Ping Identity          |
| **AuthenticationFlow**           | A configurable pipeline of authentication steps (password, MFA, consent)         | Keycloak (AuthenticationFlow), Authentik (Flow + Stage), Zitadel (Action), Auth0 (Action/Rule)      |

### Policy & Governance

| Entity                            | Description                                                                         | Observed In                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Policy (access / conditional)** | A rule or condition that gates access based on context (device, location, risk)     | Entra ID (ConditionalAccessPolicy), Okta (Policy + Rule), Ping Identity (SignOnPolicy), Authentik (Policy), JumpCloud (Policy) |
| **NetworkZone**                   | A named IP range or geography used in conditional access rules                      | Okta (NetworkZone), Entra ID (namedLocation), Ping Identity (IPRange)                                                          |
| **AuditLog / Event**              | A record of an administrative or authentication action for compliance and forensics | All providers (AuditLog in Entra ID, SystemLog in Okta, Event in Keycloak/Authentik, AuditActivity in Google)                  |

### Infrastructure

| Entity     | Description                                                            | Observed In                                                                     |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Device** | A managed device (desktop, mobile, server) registered in the directory | Entra ID (Device), Google Workspace (Device), JumpCloud (System), Okta (Device) |

---

## VAOP Canonical Mapping

| Universal Entity                  | VAOP Canonical Object                | Mapping Notes                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                              | `Party` (role: `employee` or `user`) | Direct mapping to Party. Role tag distinguishes internal employees from external/B2C users. Profile attributes (email, display name, status) normalised. Provider-specific schema extensions stored as metadata.  |
| Group                             | `ExternalObjectRef`                  | Groups are IAM-specific constructs with highly variable semantics (security group, distribution list, M365 group, POSIX group). Stored as typed external references with membership list and group type metadata. |
| Role                              | `ExternalObjectRef`                  | Role definitions and their permission sets are deeply provider-specific. Stored as external references with scope (directory-wide, app-scoped, resource-scoped) and assignment metadata.                          |
| Application / Client              | `ExternalObjectRef`                  | Registered applications with SSO configuration (SAML, OIDC, SCIM). Stored as external references preserving protocol, client ID, redirect URIs, and grant types.                                                  |
| Permission / Scope                | `ExternalObjectRef`                  | Granular access rights are provider-specific and often hierarchical. Stored as external references with resource, action, and constraint metadata.                                                                |
| Session                           | `ExternalObjectRef`                  | Authentication sessions are ephemeral and provider-scoped. Stored as external references with user link, device info, and expiry for audit correlation.                                                           |
| Factor / MFA                      | `ExternalObjectRef`                  | MFA enrolments vary by type (TOTP, SMS, WebAuthn, push). Stored as external references linked to the user Party.                                                                                                  |
| AuditLog / Event                  | `ExternalObjectRef`                  | Audit events are the core of IAM compliance. Stored as external references with actor, action, target, timestamp, and outcome. VAOP preserves the full event payload for security and compliance queries.         |
| Policy (access / conditional)     | `ExternalObjectRef`                  | Access policies are deeply provider-specific (conditions, actions, exceptions). Stored as external references preserving the policy definition for audit and documentation.                                       |
| Device                            | `Asset`                              | Mapped to Asset. Managed devices (laptops, phones, servers) registered in the directory have clear asset semantics. Device compliance state, OS version, and last activity stored as metadata.                    |
| IdentityProvider                  | `ExternalObjectRef`                  | Federated IdP configurations (SAML metadata, OIDC discovery URLs). Stored as external references preserving protocol and federation metadata.                                                                     |
| Domain / Realm / Tenant           | `ExternalObjectRef`                  | Top-level identity boundaries. Stored as external references with DNS domain, verification status, and tenant metadata. VAOP's own tenant model is separate from provider domain concepts.                        |
| DirectoryOU / OrgUnit             | `ExternalObjectRef`                  | Organisational units for hierarchical user placement. Stored as external references preserving parent-child hierarchy.                                                                                            |
| ServicePrincipal / ServiceAccount | `ExternalObjectRef`                  | Non-human identities representing applications or services. Stored as external references linked to their parent Application. Distinct from Party because they lack human profile semantics.                      |
| OAuth2Grant                       | `ExternalObjectRef`                  | Delegated permission consents. Stored as external references linking user, application, and granted scopes.                                                                                                       |
| Token                             | `ExternalObjectRef`                  | Issued tokens and API keys. Stored as external references with expiry, scope, and revocation status. Sensitive token values are never stored in VAOP.                                                             |
| AuthenticationFlow                | `ExternalObjectRef`                  | Configurable auth pipelines. Stored as external references preserving flow steps and stage configuration for documentation purposes.                                                                              |
| NetworkZone                       | `ExternalObjectRef`                  | Named IP ranges and geolocations for conditional access. Stored as external references with CIDR blocks and geographic metadata.                                                                                  |
| Schema / Attribute                | `ExternalObjectRef`                  | Custom attribute definitions extending identity profiles. Stored as external references preserving attribute name, type, and constraints.                                                                         |

---

## Notes

- **Microsoft Entra ID** and **Okta** together dominate the enterprise IAM market and should be the first two adapters implemented for Port 9. Entra ID is often the primary directory for Microsoft-centric organisations, while Okta serves as the primary IdP for multi-cloud and vendor-neutral environments.
- **Google Workspace** is the third priority due to its large installed base in education and tech-forward organisations, and because many enterprises run both Entra ID and Google Workspace simultaneously.
- The `User` entity is mapped to `Party` rather than a dedicated IAM canonical because user profiles share the same core semantics as contacts, employees, and customers across other ports. The `role` tag on Party enables cross-port identity correlation (e.g., the same Party appears as an Agent in Port 7, a Technician in Port 8, and a User in Port 9).
- Most IAM entities (Groups, Roles, Policies, Applications) are mapped to `ExternalObjectRef` rather than canonical objects because their semantics are deeply tied to the access control model of each provider. Attempting to normalise these across SAML, OIDC, LDAP, and proprietary models would lose critical security semantics.
- **Device** is the notable exception, mapped to `Asset`, because managed devices share clear asset lifecycle semantics with Port 8 (ITSM) assets. This enables cross-port correlation: a device registered in Entra ID can be correlated with the same device tracked as a CI in ServiceNow.
- **Keycloak** is recommended as the reference implementation for domain extraction due to its comprehensive Admin API, multi-realm architecture, and OIDC/SAML compliance. Its entity model closely mirrors the universal entity catalog defined above.
- Audit logs are critical for compliance (SOX, SOC 2, GDPR). VAOP preserves the full event payload as `ExternalObjectRef` to support downstream security analytics without lossy normalisation.
- SCIM (System for Cross-domain Identity Management) is not modelled as a separate entity type but is relevant as an integration protocol. Providers that support SCIM (Entra ID, Okta, OneLogin, JumpCloud) enable standardised user provisioning that VAOP adapters can leverage.
