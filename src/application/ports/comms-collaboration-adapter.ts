import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { CanonicalTaskV1 } from '../../domain/canonical/task-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const COMMS_COLLABORATION_OPERATIONS_V1 = [
  'sendMessage',
  'listMessages',
  'getMessageThread',
  'listChannels',
  'createChannel',
  'archiveChannel',
  'addUserToChannel',
  'listUsers',
  'getUser',
  'sendEmail',
  'listEmails',
  'getEmail',
  'createMeeting',
  'getMeeting',
  'listMeetings',
  'listCalendarEvents',
  'createCalendarEvent',
  'uploadFile',
  'listFiles',
] as const;

export type CommsCollaborationOperationV1 = (typeof COMMS_COLLABORATION_OPERATIONS_V1)[number];

export type CommsCollaborationOperationResultV1 =
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'task'; task: CanonicalTaskV1 }>
  | Readonly<{ kind: 'tasks'; tasks: readonly CanonicalTaskV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'documents'; documents: readonly DocumentV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: CommsCollaborationOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type CommsCollaborationExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: CommsCollaborationOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type CommsCollaborationExecuteOutputV1 =
  | Readonly<{ ok: true; result: CommsCollaborationOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface CommsCollaborationAdapterPort {
  execute(input: CommsCollaborationExecuteInputV1): Promise<CommsCollaborationExecuteOutputV1>;
}
