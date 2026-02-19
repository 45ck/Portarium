import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryCommsCollaborationAdapter } from './in-memory-comms-collaboration-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryCommsCollaborationAdapter integration', () => {
  it('supports message lifecycle and thread retrieval', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT),
    });

    const sent = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendMessage',
      payload: { body: 'Incident triage started' },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok || sent.result.kind !== 'externalRef') return;
    const messageId = sent.result.externalRef.externalId;

    const thread = await adapter.execute({
      tenantId: TENANT,
      operation: 'getMessageThread',
      payload: { messageId },
    });
    expect(thread.ok).toBe(true);
    if (!thread.ok || thread.result.kind !== 'externalRef') return;
    expect(thread.result.externalRef.externalType).toBe('message_thread');

    const messages = await adapter.execute({ tenantId: TENANT, operation: 'listMessages' });
    expect(messages.ok).toBe(true);
    if (!messages.ok || messages.result.kind !== 'externalRefs') return;
    expect(messages.result.externalRefs.some((item) => item.externalId === messageId)).toBe(true);
  });

  it('supports channel and user operations', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT),
    });

    const users = await adapter.execute({ tenantId: TENANT, operation: 'listUsers' });
    expect(users.ok).toBe(true);
    if (!users.ok || users.result.kind !== 'parties') return;
    const userId = users.result.parties[0]!.partyId;

    const createdChannel = await adapter.execute({
      tenantId: TENANT,
      operation: 'createChannel',
      payload: { name: 'war-room' },
    });
    expect(createdChannel.ok).toBe(true);
    if (!createdChannel.ok || createdChannel.result.kind !== 'externalRef') return;
    const channelId = createdChannel.result.externalRef.externalId;

    const added = await adapter.execute({
      tenantId: TENANT,
      operation: 'addUserToChannel',
      payload: { userId, channelId },
    });
    expect(added.ok).toBe(true);
    if (!added.ok || added.result.kind !== 'accepted') return;

    const archived = await adapter.execute({
      tenantId: TENANT,
      operation: 'archiveChannel',
      payload: { channelId },
    });
    expect(archived.ok).toBe(true);
    if (!archived.ok || archived.result.kind !== 'externalRef') return;
    expect(archived.result.externalRef.displayLabel).toContain('[archived]');

    const fetchedUser = await adapter.execute({
      tenantId: TENANT,
      operation: 'getUser',
      payload: { userId },
    });
    expect(fetchedUser.ok).toBe(true);
    if (!fetchedUser.ok || fetchedUser.result.kind !== 'party') return;
    expect(fetchedUser.result.party.partyId).toBe(userId);
  });

  it('supports email, meetings, calendar events, and files', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const email = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendEmail',
      payload: { subject: 'Runbook updated' },
    });
    expect(email.ok).toBe(true);
    if (!email.ok || email.result.kind !== 'externalRef') return;
    const emailId = email.result.externalRef.externalId;

    const listedEmails = await adapter.execute({ tenantId: TENANT, operation: 'listEmails' });
    expect(listedEmails.ok).toBe(true);
    if (!listedEmails.ok || listedEmails.result.kind !== 'externalRefs') return;
    expect(listedEmails.result.externalRefs.some((item) => item.externalId === emailId)).toBe(true);

    const meeting = await adapter.execute({
      tenantId: TENANT,
      operation: 'createMeeting',
      payload: { title: 'CAB review' },
    });
    expect(meeting.ok).toBe(true);
    if (!meeting.ok || meeting.result.kind !== 'externalRef') return;
    const meetingId = meeting.result.externalRef.externalId;

    const fetchedMeeting = await adapter.execute({
      tenantId: TENANT,
      operation: 'getMeeting',
      payload: { meetingId },
    });
    expect(fetchedMeeting.ok).toBe(true);
    if (!fetchedMeeting.ok || fetchedMeeting.result.kind !== 'externalRef') return;
    expect(fetchedMeeting.result.externalRef.externalId).toBe(meetingId);

    const listedMeetings = await adapter.execute({ tenantId: TENANT, operation: 'listMeetings' });
    expect(listedMeetings.ok).toBe(true);
    if (!listedMeetings.ok || listedMeetings.result.kind !== 'externalRefs') return;
    expect(listedMeetings.result.externalRefs.some((item) => item.externalId === meetingId)).toBe(true);

    const event = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCalendarEvent',
      payload: { title: 'Deploy window' },
    });
    expect(event.ok).toBe(true);
    if (!event.ok || event.result.kind !== 'task') return;
    expect(event.result.task.title).toBe('Deploy window');

    const calendar = await adapter.execute({ tenantId: TENANT, operation: 'listCalendarEvents' });
    expect(calendar.ok).toBe(true);
    if (!calendar.ok || calendar.result.kind !== 'tasks') return;
    expect(calendar.result.tasks.length).toBeGreaterThan(0);

    const uploaded = await adapter.execute({
      tenantId: TENANT,
      operation: 'uploadFile',
      payload: { title: 'Deployment Checklist', mimeType: 'text/plain' },
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok || uploaded.result.kind !== 'document') return;
    expect(uploaded.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');

    const files = await adapter.execute({ tenantId: TENANT, operation: 'listFiles' });
    expect(files.ok).toBe(true);
    if (!files.ok || files.result.kind !== 'documents') return;
    expect(files.result.documents.some((item) => item.title === 'Deployment Checklist')).toBe(true);
  });

  it('returns validation errors for required fields', async () => {
    const adapter = new InMemoryCommsCollaborationAdapter({
      seed: InMemoryCommsCollaborationAdapter.seedMinimal(TENANT),
    });

    const missingMessageId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getMessageThread',
      payload: {},
    });
    expect(missingMessageId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'messageId is required for getMessageThread.',
    });

    const missingUserId = await adapter.execute({
      tenantId: TENANT,
      operation: 'addUserToChannel',
      payload: { channelId: 'channel-1000' },
    });
    expect(missingUserId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'userId is required for addUserToChannel.',
    });

    const missingTitle = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCalendarEvent',
      payload: {},
    });
    expect(missingTitle).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'title is required for createCalendarEvent.',
    });
  });
});
