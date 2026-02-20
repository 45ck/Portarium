import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { CanonicalTaskV1 } from '../../../domain/canonical/task-v1.js';
import { CanonicalTaskId, DocumentId, PartyId } from '../../../domain/primitives/index.js';
import type {
  CommsCollaborationAdapterPort,
  CommsCollaborationExecuteInputV1,
  CommsCollaborationExecuteOutputV1,
} from '../../../application/ports/comms-collaboration-adapter.js';
import { COMMS_COLLABORATION_OPERATIONS_V1 } from '../../../application/ports/comms-collaboration-adapter.js';

const OPERATION_SET = new Set<string>(COMMS_COLLABORATION_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: CommsCollaborationExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type MessageThreadEntry = Readonly<{
  tenantId: CommsCollaborationExecuteInputV1['tenantId'];
  messageId: string;
  threadRef: ExternalObjectRef;
}>;

type ChannelMembershipEntry = Readonly<{
  tenantId: CommsCollaborationExecuteInputV1['tenantId'];
  channelId: string;
  userId: string;
}>;

type InMemoryCommsCollaborationAdapterSeed = Readonly<{
  messages?: readonly TenantExternalRef[];
  messageThreads?: readonly MessageThreadEntry[];
  channels?: readonly TenantExternalRef[];
  users?: readonly PartyV1[];
  emails?: readonly TenantExternalRef[];
  meetings?: readonly TenantExternalRef[];
  calendarEvents?: readonly CanonicalTaskV1[];
  files?: readonly DocumentV1[];
  channelMemberships?: readonly ChannelMembershipEntry[];
}>;

type InMemoryCommsCollaborationAdapterParams = Readonly<{
  seed?: InMemoryCommsCollaborationAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryCommsCollaborationAdapter implements CommsCollaborationAdapterPort {
  readonly #now: () => Date;
  readonly #messages: TenantExternalRef[];
  readonly #messageThreads: MessageThreadEntry[];
  readonly #channels: TenantExternalRef[];
  readonly #users: PartyV1[];
  readonly #emails: TenantExternalRef[];
  readonly #meetings: TenantExternalRef[];
  readonly #calendarEvents: CanonicalTaskV1[];
  readonly #files: DocumentV1[];
  readonly #channelMemberships: ChannelMembershipEntry[];
  #messageSequence: number;
  #channelSequence: number;
  #emailSequence: number;
  #meetingSequence: number;
  #eventSequence: number;
  #fileSequence: number;

  public constructor(params?: InMemoryCommsCollaborationAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#messages = [...(params?.seed?.messages ?? [])];
    this.#messageThreads = [...(params?.seed?.messageThreads ?? [])];
    this.#channels = [...(params?.seed?.channels ?? [])];
    this.#users = [...(params?.seed?.users ?? [])];
    this.#emails = [...(params?.seed?.emails ?? [])];
    this.#meetings = [...(params?.seed?.meetings ?? [])];
    this.#calendarEvents = [...(params?.seed?.calendarEvents ?? [])];
    this.#files = [...(params?.seed?.files ?? [])];
    this.#channelMemberships = [...(params?.seed?.channelMemberships ?? [])];
    this.#messageSequence = this.#messages.length;
    this.#channelSequence = this.#channels.length;
    this.#emailSequence = this.#emails.length;
    this.#meetingSequence = this.#meetings.length;
    this.#eventSequence = this.#calendarEvents.length;
    this.#fileSequence = this.#files.length;
  }

  public async execute(
    input: CommsCollaborationExecuteInputV1,
  ): Promise<CommsCollaborationExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported CommsCollaboration operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'sendMessage':
        return this.#sendMessage(input);
      case 'listMessages':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#messages, input),
          },
        };
      case 'getMessageThread':
        return this.#getMessageThread(input);
      case 'listChannels':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#channels, input),
          },
        };
      case 'createChannel':
        return this.#createChannel(input);
      case 'archiveChannel':
        return this.#archiveChannel(input);
      case 'addUserToChannel':
        return this.#addUserToChannel(input);
      case 'listUsers':
        return { ok: true, result: { kind: 'parties', parties: this.#listUsers(input) } };
      case 'getUser':
        return this.#getUser(input);
      case 'sendEmail':
        return this.#sendEmail(input);
      case 'listEmails':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#emails, input) },
        };
      case 'getEmail':
        return this.#getTenantRef(input, this.#emails, 'emailId', 'Email', 'getEmail');
      case 'createMeeting':
        return this.#createMeeting(input);
      case 'getMeeting':
        return this.#getTenantRef(input, this.#meetings, 'meetingId', 'Meeting', 'getMeeting');
      case 'listMeetings':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#meetings, input),
          },
        };
      case 'listCalendarEvents':
        return { ok: true, result: { kind: 'tasks', tasks: this.#listCalendarEvents(input) } };
      case 'createCalendarEvent':
        return this.#createCalendarEvent(input);
      case 'uploadFile':
        return this.#uploadFile(input);
      case 'listFiles':
        return { ok: true, result: { kind: 'documents', documents: this.#listFiles(input) } };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported CommsCollaboration operation: ${String(input.operation)}.`,
        };
    }
  }

  #sendMessage(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const body = readString(input.payload, 'body');
    if (body === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'body is required for sendMessage.',
      };
    }

    const messageExternalId = `message-${++this.#messageSequence}`;
    const externalRef: ExternalObjectRef = {
      sorName: 'CommsSuite',
      portFamily: 'CommsCollaboration',
      externalId: messageExternalId,
      externalType: 'message',
      displayLabel: body.length > 64 ? `${body.slice(0, 61)}...` : body,
    };
    this.#messages.push({ tenantId: input.tenantId, externalRef });

    const threadRef: ExternalObjectRef = {
      sorName: 'CommsSuite',
      portFamily: 'CommsCollaboration',
      externalId: `thread-${messageExternalId}`,
      externalType: 'message_thread',
      displayLabel: `Thread for ${messageExternalId}`,
    };
    this.#messageThreads.push({
      tenantId: input.tenantId,
      messageId: messageExternalId,
      threadRef,
    });

    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getMessageThread(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const messageId = readString(input.payload, 'messageId');
    if (messageId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'messageId is required for getMessageThread.',
      };
    }

    const thread = this.#messageThreads.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.messageId === messageId,
    );
    if (thread === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Message thread for ${messageId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: thread.threadRef } };
  }

  #createChannel(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createChannel.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'CommsSuite',
      portFamily: 'CommsCollaboration',
      externalId: `channel-${++this.#channelSequence}`,
      externalType: 'channel',
      displayLabel: name,
    };
    this.#channels.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #archiveChannel(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const channelId = readString(input.payload, 'channelId');
    if (channelId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'channelId is required for archiveChannel.',
      };
    }

    const index = this.#channels.findIndex(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === channelId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Channel ${channelId} was not found.` };
    }

    const current = this.#channels[index]!;
    const displayLabel = current.externalRef.displayLabel ?? channelId;
    const externalRef: ExternalObjectRef = {
      ...current.externalRef,
      displayLabel: displayLabel.endsWith(' [archived]')
        ? displayLabel
        : `${displayLabel} [archived]`,
    };
    this.#channels[index] = { tenantId: input.tenantId, externalRef };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #addUserToChannel(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for addUserToChannel.',
      };
    }

    const channelId = readString(input.payload, 'channelId');
    if (channelId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'channelId is required for addUserToChannel.',
      };
    }

    const user = this.#users.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === userId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${userId} was not found.` };
    }
    void user;

    const channel = this.#channels.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === channelId,
    );
    if (channel === undefined) {
      return { ok: false, error: 'not_found', message: `Channel ${channelId} was not found.` };
    }
    void channel;

    const exists = this.#channelMemberships.some(
      (membership) =>
        membership.tenantId === input.tenantId &&
        membership.userId === userId &&
        membership.channelId === channelId,
    );
    if (!exists) {
      this.#channelMemberships.push({ tenantId: input.tenantId, channelId, userId });
    }

    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #listUsers(input: CommsCollaborationExecuteInputV1): readonly PartyV1[] {
    return this.#users.filter((user) => user.tenantId === input.tenantId);
  }

  #getUser(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for getUser.',
      };
    }

    const user = this.#users.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === userId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${userId} was not found.` };
    }
    return { ok: true, result: { kind: 'party', party: user } };
  }

  #sendEmail(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for sendEmail.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'CommsSuite',
      portFamily: 'CommsCollaboration',
      externalId: `email-${++this.#emailSequence}`,
      externalType: 'email',
      displayLabel: subject,
    };
    this.#emails.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createMeeting(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createMeeting.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'CommsSuite',
      portFamily: 'CommsCollaboration',
      externalId: `meeting-${++this.#meetingSequence}`,
      externalType: 'meeting',
      displayLabel: title,
      deepLinkUrl: `https://comms.example/meetings/${this.#meetingSequence}`,
    };
    this.#meetings.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listCalendarEvents(input: CommsCollaborationExecuteInputV1): readonly CanonicalTaskV1[] {
    return this.#calendarEvents.filter((event) => event.tenantId === input.tenantId);
  }

  #createCalendarEvent(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createCalendarEvent.',
      };
    }

    const task: CanonicalTaskV1 = {
      canonicalTaskId: CanonicalTaskId(`calendar-event-${++this.#eventSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      status: 'todo',
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
      ...(typeof input.payload?.['dueAtIso'] === 'string'
        ? { dueAtIso: input.payload['dueAtIso'] }
        : {}),
    };
    this.#calendarEvents.push(task);
    return { ok: true, result: { kind: 'task', task } };
  }

  #uploadFile(input: CommsCollaborationExecuteInputV1): CommsCollaborationExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for uploadFile.',
      };
    }

    const sizeBytes = readNumber(input.payload, 'sizeBytes');
    if (sizeBytes !== null && sizeBytes < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'sizeBytes must be a non-negative number for uploadFile.',
      };
    }

    const document: DocumentV1 = {
      documentId: DocumentId(`document-${++this.#fileSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      mimeType:
        typeof input.payload?.['mimeType'] === 'string'
          ? input.payload['mimeType']
          : 'application/octet-stream',
      ...(sizeBytes !== null ? { sizeBytes } : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#files.push(document);
    return { ok: true, result: { kind: 'document', document } };
  }

  #listFiles(input: CommsCollaborationExecuteInputV1): readonly DocumentV1[] {
    return this.#files.filter((file) => file.tenantId === input.tenantId);
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: CommsCollaborationExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: CommsCollaborationExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): CommsCollaborationExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: CommsCollaborationExecuteInputV1['tenantId'],
  ): InMemoryCommsCollaborationAdapterSeed {
    return {
      messages: [
        {
          tenantId,
          externalRef: {
            sorName: 'CommsSuite',
            portFamily: 'CommsCollaboration',
            externalId: 'message-1000',
            externalType: 'message',
            displayLabel: 'Welcome to #ops',
          },
        },
      ],
      messageThreads: [
        {
          tenantId,
          messageId: 'message-1000',
          threadRef: {
            sorName: 'CommsSuite',
            portFamily: 'CommsCollaboration',
            externalId: 'thread-message-1000',
            externalType: 'message_thread',
            displayLabel: 'Thread for message-1000',
          },
        },
      ],
      channels: [
        {
          tenantId,
          externalRef: {
            sorName: 'CommsSuite',
            portFamily: 'CommsCollaboration',
            externalId: 'channel-1000',
            externalType: 'channel',
            displayLabel: 'ops-alerts',
          },
        },
      ],
      users: [
        {
          partyId: PartyId('user-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Avery Operator',
          email: 'avery.operator@example.com',
          roles: ['user'],
        },
      ],
      emails: [
        {
          tenantId,
          externalRef: {
            sorName: 'CommsSuite',
            portFamily: 'CommsCollaboration',
            externalId: 'email-1000',
            externalType: 'email',
            displayLabel: 'Status Update',
          },
        },
      ],
      meetings: [
        {
          tenantId,
          externalRef: {
            sorName: 'CommsSuite',
            portFamily: 'CommsCollaboration',
            externalId: 'meeting-1000',
            externalType: 'meeting',
            displayLabel: 'Weekly Operations Sync',
          },
        },
      ],
      calendarEvents: [
        {
          canonicalTaskId: CanonicalTaskId('calendar-event-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Weekly Operations Sync',
          status: 'todo',
        },
      ],
      files: [
        {
          documentId: DocumentId('document-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Runbook',
          mimeType: 'application/pdf',
          createdAtIso: '2026-02-19T00:00:00.000Z',
        },
      ],
      channelMemberships: [
        {
          tenantId,
          channelId: 'channel-1000',
          userId: 'user-1000',
        },
      ],
    };
  }
}
