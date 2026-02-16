# Port 13: Comms & Collaboration — Integration Catalog

## Port Operations

- `sendMessage` — Send a chat message, email, or SMS to a channel, thread, or recipient
- `listMessages` — Return messages filtered by channel, sender, date range, or keyword
- `getChannel` — Retrieve a single channel / room / conversation by canonical ID
- `listChannels` — List channels filtered by team, type (public/private/DM), or archive status
- `createChannel` — Create a new channel or conversation within a workspace
- `archiveChannel` — Archive or close a channel so it becomes read-only
- `listUsers` — Return users / members filtered by team, role, or presence status
- `getUser` — Retrieve a single user profile by canonical ID or external ref
- `setPresence` — Update a user's presence or status (online, away, DND, custom text)
- `listTeams` — List teams or workspaces within the connected account
- `createMeeting` — Schedule a new video / audio meeting with participants and time
- `getMeeting` — Retrieve meeting details including join URL, participants, and recordings
- `sendEmail` — Compose and send an email message via the connected provider
- `getEmail` — Retrieve a single email message by ID including headers and body
- `listEmails` — List email messages filtered by folder, label, sender, or date range
- `listCalendarEvents` — Return calendar events filtered by calendar, date range, or attendee
- `createCalendarEvent` — Create a new calendar event with title, time, attendees, and recurrence

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider                                       | Source                                                   | Adoption | Est. Customers                         | API Style                                              | Webhooks                                                    | Key Entities                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------- | -------- | -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Slack**                                      | S1 — full REST API with OpenAPI spec, sandbox workspaces | A1       | ~750k+ organisations                   | REST (JSON) + Events API, OAuth 2.0                    | Yes — Events API with URL verification, Socket Mode for dev | Message, Channel, User, Team, Workspace, File, Reaction, Thread, Block, Workflow, Reminder, UserGroup, Conversation, App, Bot |
| **Microsoft Teams**                            | S1 — Microsoft Graph REST API, developer sandbox tenants | A1       | ~320M+ monthly active users            | REST (JSON) via Graph API, OAuth 2.0 (delegated + app) | Yes — change notifications via Graph subscriptions          | Message, Channel, Team, User, Chat, Meeting, Call, DriveItem, Tab, App, Presence, Shift, Schedule                             |
| **Google Workspace (Gmail / Calendar / Chat)** | S1 — full REST APIs with discovery docs, OAuth 2.0       | A1       | ~3B+ Gmail users, ~10M+ Workspace orgs | REST (JSON), OAuth 2.0                                 | Yes — Gmail push via Pub/Sub, Calendar push notifications   | Message (Gmail), Thread, Label, Draft, CalendarEvent, Calendar, Attendee, ChatSpace, ChatMessage, File (Drive)                |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider                         | Source                                            | Adoption | Est. Customers                                     | API Style                                 | Webhooks                                               | Key Entities                                                                                            |
| -------------------------------- | ------------------------------------------------- | -------- | -------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Zoom**                         | S1 — REST API with OpenAPI spec, sandbox accounts | A2       | ~300k+ enterprise customers                        | REST (JSON), OAuth 2.0 / Server-to-Server | Yes — event subscriptions with validation token        | Meeting, Webinar, Recording, User, Group, Room, Chat, Channel, Contact, Report, Dashboard               |
| **Microsoft Outlook / Exchange** | S1 — Microsoft Graph API, same sandbox as Teams   | A2       | Part of Microsoft 365 base (~400M+ seats)          | REST (JSON) via Graph API, OAuth 2.0      | Yes — Graph change notifications on mail, calendar     | Message, MailFolder, Calendar, Event, Contact, Attachment, Rule, Category                               |
| **Twilio (SMS / Voice)**         | S1 — REST API with OpenAPI spec, trial accounts   | A2       | ~300k+ active customer accounts                    | REST (JSON), Basic Auth                   | Yes — status callbacks per message and call            | Message (SMS), Call, PhoneNumber, Account, Conversation, Participant, Recording, Workspace (TaskRouter) |
| **SendGrid (Twilio)**            | S1 — REST API v3 with full docs, free tier        | A2       | Part of Twilio customer base, ~80k+ active senders | REST (JSON), API key auth                 | Yes — Event Webhook for delivery, open, click tracking | Message (Email), Contact, List, Segment, Template, Sender, Suppression, Stats, SingleSend, Automation   |

### Best OSS for Domain Extraction

| Project                        | Source                                                | API Style                             | Key Entities                                                                            | Notes                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mattermost**                 | S1 — self-hosted, full REST API v4 with OpenAPI spec  | REST (JSON), webhooks, slash commands | Post, Channel, Team, User, File, Reaction, Thread, Webhook, Bot, Command, Plugin, Emoji | Slack-alternative with strong enterprise adoption (~800k+ deployments). Excellent API parity with commercial tools. Plugin architecture extends entity model. Good reference for channel-based messaging normalisation. |
| **Rocket.Chat**                | S1 — self-hosted, REST API with real-time (WebSocket) | REST (JSON), DDP/WebSocket            | Message, Channel, User, Group, Team, File, Integration, Role, Subscription, Room        | Open-source team chat (~12M+ users). Real-time API adds streaming capability. Room types (channel, group, DM, livechat) provide good coverage of conversation models.                                                   |
| **Matrix (Element / Synapse)** | S1 — federated protocol, full client-server spec      | REST (JSON), Matrix Client-Server API | Event (message), Room, User, Device, Space, PowerLevel, MediaContent, Filter            | Decentralised communication protocol. Events-as-entities model is unique — every message, state change, and membership update is an immutable Event. Good reference for federation and E2EE patterns.                   |

### Tier A3 — Established Niche

| Provider          | Source                                                   | Adoption | Notes                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discord**       | S1 — REST + Gateway (WebSocket), bot developer programme | A3       | Community-centric messaging with ~200M+ MAU. Strong in gaming and developer communities. Entities: Message, Channel, Guild (server), User, Role, Emoji, Reaction, Webhook, Interaction, Thread, Stage, VoiceState. Gateway provides real-time event streaming. |
| **Webex (Cisco)** | S1 — REST API with SDK, sandbox accounts                 | A3       | Enterprise meetings and messaging platform. Part of Cisco collab suite. Entities: Message, Room, Person, Team, Meeting, Recording, Membership, Webhook, Attachment, Space. Strong in regulated industries (healthcare, government).                            |
| **RingCentral**   | S1 — REST API with sandbox, OAuth 2.0                    | A3       | UCaaS / cloud telephony with ~400k+ customers. Entities: Message (SMS/MMS/Fax), Call, Extension, PhoneNumber, Meeting, Voicemail, CallLog, Presence, Contact, Account. Strong in unified communications.                                                       |

### Tier A4 — Emerging / Regional

| Provider             | Source                                                | Adoption | Notes                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vonage**           | S1 — REST APIs (Messages, Voice, Video), API key auth | A4       | CPaaS platform for SMS, voice, video, and messaging channels. Entities: Message, Call, Conversation, Member, Event, Application, Number, Recording. Multi-channel API unifies SMS, MMS, WhatsApp, Viber, and FB Messenger.         |
| **Lark (ByteDance)** | S1 — REST API, OAuth 2.0                              | A4       | APAC-focused collaboration suite combining messaging, docs, calendar, and video. Entities: Message, Chat, User, Department, Calendar, Event, Drive, Doc, Sheet, Approval, Bot. Growing adoption in Asia-Pacific enterprise market. |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by communication domain.

### Messaging & Channels

- **Message** — A chat message, email body, or SMS/voice record (observed in all providers under various names: Message, Post, ChatMessage, Event)
- **Channel / Room / Space / Conversation** — A container for messages; may be public, private, DM, or group (Channel in Slack/Teams/Zoom, Room in Rocket.Chat/Matrix/Webex, Space in Google Chat/Matrix, Conversation in Twilio)
- **Thread / Topic** — A sub-conversation branching from a parent message (Thread in Slack/Mattermost, Topic in some providers)
- **Reaction / Emoji** — A lightweight response attached to a message (Reaction in Slack/Mattermost/Matrix, Emoji in Discord)
- **Block** — A structured UI element within a message (Slack Block Kit)

### People & Presence

- **User / Member / Participant** — A person within the communication system (User in most providers, Member in Webex/Twilio, Person in Webex, Participant in Twilio)
- **Team / Workspace / Organization** — A top-level grouping of users and channels (Team in Slack/Teams/Mattermost, Workspace in Slack/Mattermost, Guild in Discord, Organization in some providers)
- **Bot / App / Integration** — An automated participant or connected application (Bot in Slack/Mattermost/Lark, App in Slack/Teams/Discord, Integration in Rocket.Chat)
- **Presence / Status** — Real-time availability indicator (online, away, DND, custom) for a user (Presence in Teams/RingCentral, Status in Slack)
- **Contact / Address** — An address book entry or external contact reference (Contact in Zoom/Outlook/RingCentral/SendGrid)
- **UserGroup** — A named group of users for mentions and notifications (UserGroup in Slack, Role in Discord)

### Meetings & Calls

- **Meeting / Call / Webinar** — A scheduled or ad-hoc audio/video session (Meeting in Teams/Zoom/Webex, Call in Twilio/RingCentral, Webinar in Zoom)
- **Recording** — A saved audio/video/screen capture from a meeting or call (Recording in Zoom/Webex/Twilio/RingCentral)
- **PhoneNumber** — A provisioned telephone number for SMS or voice (PhoneNumber in Twilio/RingCentral/Vonage)

### Email & Calendar

- **Draft** — An unsent email message (Draft in Gmail)
- **Label / Category / Tag** — A classification applied to messages or channels (Label in Gmail, Category in Outlook, Tag in Mattermost)
- **Calendar / CalendarEvent / Attendee** — Calendar containers, events, and participant records (Calendar and Event in Google/Outlook/Lark, Attendee in Google Calendar)
- **MailFolder** — A container for email messages (MailFolder in Outlook, Label in Gmail)

### Content & Automation

- **File / Attachment / DriveItem** — A file shared within a conversation or stored in connected storage (File in Slack/Mattermost/Rocket.Chat, Attachment in various, DriveItem in Teams)
- **Template** — A reusable message or email layout (Template in SendGrid)
- **Notification / Reminder** — A scheduled or triggered alert to a user (Reminder in Slack, Notification in Vonage)
- **Suppression / DNC** — An opt-out or do-not-contact record (Suppression in SendGrid, DNC lists)
- **Workflow / Automation / Rule** — An automated process triggered by events (Workflow in Slack, Automation in SendGrid, Rule in Outlook)

---

## VAOP Canonical Mapping

| Universal Entity                      | VAOP Canonical Object      | Mapping Notes                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message (chat / email / SMS)          | `ExternalObjectRef`        | Messages are transactional, provider-scoped records with highly variable schemas (rich text, blocks, HTML, plain). Stored as typed external references with a `message_type` discriminator (chat, email, sms, voice). |
| Channel / Room / Space / Conversation | `ExternalObjectRef`        | Channel structures vary significantly (public/private/DM, ephemeral/persistent). Stored as external references with channel type metadata. Parent team/workspace linked via relationship.                             |
| User / Member / Participant           | `Party` (role: `employee`) | Mapped to Party with employee role. Display name, email, and avatar normalised. External user IDs preserved in `ExternalObjectRef` link. Presence data stored as transient metadata.                                  |
| Team / Workspace / Organization       | `ExternalObjectRef`        | Top-level containers vary across providers. Stored as external references with hierarchy metadata (workspace → team → channel).                                                                                       |
| Thread / Topic                        | `ExternalObjectRef`        | Sub-conversations linked to parent Message external ref. Thread reply counts and participants stored as metadata.                                                                                                     |
| File / Attachment / DriveItem         | `Document`                 | Direct mapping. File metadata (name, size, MIME type, thumbnail URL) normalised. Binary content referenced by provider URL or VAOP storage key.                                                                       |
| Meeting / Call / Webinar              | `ExternalObjectRef`        | Meeting structures vary (scheduled vs. instant, recurring, webinar). Stored as typed external references with join URL, duration, and participant list as metadata.                                                   |
| CalendarEvent                         | `ExternalObjectRef`        | Calendar events with time, recurrence, and attendee data. Stored as external references preserving timezone and recurrence rules.                                                                                     |
| Contact                               | `Party` (role: `contact`)  | External contacts from address books. Mapped to Party with contact role. Phone, email, and company fields normalised.                                                                                                 |
| Recording                             | `Document`                 | Audio/video recordings mapped to Document with media-specific metadata (duration, format, transcript URL). Binary content referenced by provider URL.                                                                 |
| Template                              | `Document`                 | Reusable message/email templates mapped to Document with `type: template`. Template variables and layout preserved in structured metadata.                                                                            |
| PhoneNumber                           | `ExternalObjectRef`        | Provisioned numbers with capabilities (SMS, voice, MMS). Stored as external references with number format (E.164) and capability flags.                                                                               |
| Reaction / Emoji                      | `ExternalObjectRef`        | Lightweight message annotations. Stored as external references linked to parent Message ref.                                                                                                                          |
| Bot / App / Integration               | `ExternalObjectRef`        | Automated participants and connected apps. Stored as external references with scope and permission metadata.                                                                                                          |
| Presence / Status                     | `ExternalObjectRef`        | Transient user state. Stored as external references with TTL metadata; not persisted long-term.                                                                                                                       |
| Notification / Reminder               | `ExternalObjectRef`        | Scheduled alerts linked to users. Stored as external references with trigger time and delivery status.                                                                                                                |
| Suppression / DNC                     | `ExternalObjectRef`        | Opt-out records for email/SMS channels. Stored as external references linked to the relevant Party.                                                                                                                   |
| Label / Category / Tag                | `ExternalObjectRef`        | Classification labels for messages and channels. Stored as external references applied via many-to-many relationships.                                                                                                |
| Draft                                 | `ExternalObjectRef`        | Unsent email messages. Stored as external references with body and recipient metadata; promoted to Message on send.                                                                                                   |
| Workflow / Automation                 | `ExternalObjectRef`        | Provider-specific automation rules. Stored as external references for audit and sync; VAOP does not execute them cross-platform.                                                                                      |

---

## Notes

- **Slack** and **Microsoft Teams** together dominate enterprise team messaging and should be the first two adapters implemented for Port 13.
- **Google Workspace** is critical because it spans email (Gmail), calendar, and chat — three sub-domains within a single provider. Adapter design should use separate sub-adapters per Google API surface.
- **Twilio** and **SendGrid** cover programmatic SMS/voice and transactional email respectively. They share a parent company and customer base, enabling cross-adapter credential reuse.
- The `Message` entity deliberately unifies chat messages, emails, and SMS under a single external reference type. A `message_type` discriminator preserves the original channel semantics.
- Calendar events are kept as `ExternalObjectRef` rather than a dedicated canonical because calendar functionality is secondary to the core messaging use case. If calendar integrations grow in importance, a dedicated `CalendarEvent` canonical may be warranted.
- Real-time event streaming (Slack Events API, Teams Graph subscriptions, Matrix sync) is essential for keeping message data current. Adapter implementations should prefer push-based sync where available.
