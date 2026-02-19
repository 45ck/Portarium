import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCommsCollaborationAdapter } from './in-memory-comms-collaboration-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryCommsCollaborationAdapter', () => {
  it('returns tenant-scoped users and files', async () => {
    const seedA = InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_B);

    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: {
        ...seedA,
        users: [...seedA.users!, ...seedB.users!],
        files: [...seedA.files!, ...seedB.files!],
      },
    });

    const users = await adapter.execute({ tenantId: TENANT_A, operation: 'listUsers' });
    expect(users.ok).toBe(true);
    if (!users.ok || users.result.kind !== 'parties') return;
    expect(users.result.parties).toHaveLength(1);
    expect(users.result.parties[0]?.tenantId).toBe(TENANT_A);

    const files = await adapter.execute({ tenantId: TENANT_A, operation: 'listFiles' });
    expect(files.ok).toBe(true);
    if (!files.ok || files.result.kind !== 'documents') return;
    expect(files.result.documents).toHaveLength(1);
    expect(files.result.documents[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports messaging and thread retrieval', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_A),
    });

    const sent = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'sendMessage',
      payload: { body: 'Incident status: mitigated' },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok || sent.result.kind !== 'externalRef') return;
    const messageId = sent.result.externalRef.externalId;

    const thread = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getMessageThread',
      payload: { messageId },
    });
    expect(thread.ok).toBe(true);
    if (!thread.ok || thread.result.kind !== 'externalRef') return;
    expect(thread.result.externalRef.externalType).toBe('message_thread');

    const messages = await adapter.execute({ tenantId: TENANT_A, operation: 'listMessages' });
    expect(messages.ok).toBe(true);
    if (!messages.ok || messages.result.kind !== 'externalRefs') return;
    expect(messages.result.externalRefs.some((item) => item.externalId === messageId)).toBe(true);
  });

  it('supports channel lifecycle and user membership', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_A),
    });

    const channel = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createChannel',
      payload: { name: 'launch-room' },
    });
    expect(channel.ok).toBe(true);
    if (!channel.ok || channel.result.kind !== 'externalRef') return;
    const channelId = channel.result.externalRef.externalId;

    const added = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addUserToChannel',
      payload: { userId: 'user-1000', channelId },
    });
    expect(added.ok).toBe(true);
    if (!added.ok || added.result.kind !== 'accepted') return;

    const archived = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'archiveChannel',
      payload: { channelId },
    });
    expect(archived.ok).toBe(true);
    if (!archived.ok || archived.result.kind !== 'externalRef') return;
    expect(archived.result.externalRef.displayLabel).toContain('[archived]');

    const channels = await adapter.execute({ tenantId: TENANT_A, operation: 'listChannels' });
    expect(channels.ok).toBe(true);
    if (!channels.ok || channels.result.kind !== 'externalRefs') return;
    expect(channels.result.externalRefs.some((item) => item.externalId === channelId)).toBe(true);
  });

  it('supports email, meetings, calendar events, and file uploads', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const email = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'sendEmail',
      payload: { subject: 'Daily digest' },
    });
    expect(email.ok).toBe(true);
    if (!email.ok || email.result.kind !== 'externalRef') return;
    const emailId = email.result.externalRef.externalId;

    const fetchedEmail = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getEmail',
      payload: { emailId },
    });
    expect(fetchedEmail.ok).toBe(true);
    if (!fetchedEmail.ok || fetchedEmail.result.kind !== 'externalRef') return;
    expect(fetchedEmail.result.externalRef.externalId).toBe(emailId);

    const meeting = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createMeeting',
      payload: { title: 'Ops Council' },
    });
    expect(meeting.ok).toBe(true);
    if (!meeting.ok || meeting.result.kind !== 'externalRef') return;
    const meetingId = meeting.result.externalRef.externalId;

    const fetchedMeeting = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getMeeting',
      payload: { meetingId },
    });
    expect(fetchedMeeting.ok).toBe(true);
    if (!fetchedMeeting.ok || fetchedMeeting.result.kind !== 'externalRef') return;
    expect(fetchedMeeting.result.externalRef.externalId).toBe(meetingId);

    const event = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCalendarEvent',
      payload: { title: 'Change freeze', dueAtIso: '2026-02-20T12:00:00.000Z' },
    });
    expect(event.ok).toBe(true);
    if (!event.ok || event.result.kind !== 'task') return;
    expect(event.result.task.status).toBe('todo');

    const events = await adapter.execute({ tenantId: TENANT_A, operation: 'listCalendarEvents' });
    expect(events.ok).toBe(true);
    if (!events.ok || events.result.kind !== 'tasks') return;
    expect(events.result.tasks.length).toBeGreaterThan(0);

    const uploaded = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadFile',
      payload: { title: 'Postmortem', mimeType: 'text/markdown', sizeBytes: 1024 },
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok || uploaded.result.kind !== 'document') return;
    expect(uploaded.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
  });

  it('returns validation errors for missing required payload fields', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT_A),
    });

    const missingBody = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'sendMessage',
      payload: {},
    });
    expect(missingBody).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'body is required for sendMessage.',
    });

    const missingChannel = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addUserToChannel',
      payload: { userId: 'user-1000' },
    });
    expect(missingChannel).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'channelId is required for addUserToChannel.',
    });

    const invalidFile = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadFile',
      payload: { title: 'Bad', sizeBytes: -1 },
    });
    expect(invalidFile).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'sizeBytes must be a non-negative number for uploadFile.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'sendMessage',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported CommsCollaboration operation: bogusOperation.',
    });
  });
});
