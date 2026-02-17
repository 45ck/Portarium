import { describe, expect, it } from 'vitest';

import { TicketParseError, parseTicketV1 } from './ticket-v1.js';

describe('parseTicketV1', () => {
  const valid = {
    ticketId: 'tkt-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    subject: 'Cannot login',
    status: 'open',
    priority: 'high',
    assigneeId: 'user-42',
    createdAtIso: '2026-02-17T10:00:00.000Z',
    externalRefs: [
      {
        sorName: 'zendesk',
        portFamily: 'CustomerSupport',
        externalId: 'zd-100',
        externalType: 'Ticket',
      },
    ],
  };

  it('parses a full TicketV1 with all fields', () => {
    const ticket = parseTicketV1(valid);
    expect(ticket.ticketId).toBe('tkt-1');
    expect(ticket.status).toBe('open');
    expect(ticket.priority).toBe('high');
    expect(ticket.assigneeId).toBe('user-42');
    expect(ticket.externalRefs).toHaveLength(1);
  });

  it('parses a minimal TicketV1 (required fields only)', () => {
    const ticket = parseTicketV1({
      ticketId: 'tkt-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      subject: 'Help',
      status: 'pending',
      createdAtIso: '2026-02-17T10:00:00.000Z',
    });
    expect(ticket.ticketId).toBe('tkt-2');
    expect(ticket.priority).toBeUndefined();
    expect(ticket.assigneeId).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseTicketV1('nope')).toThrow(TicketParseError);
    expect(() => parseTicketV1(null)).toThrow(TicketParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseTicketV1({ ...valid, subject: '' })).toThrow(/subject/);
  });

  it('rejects invalid status', () => {
    expect(() => parseTicketV1({ ...valid, status: 'unknown' })).toThrow(/status/);
  });

  it('rejects invalid priority', () => {
    expect(() => parseTicketV1({ ...valid, priority: 'critical' })).toThrow(/priority/);
  });
});
