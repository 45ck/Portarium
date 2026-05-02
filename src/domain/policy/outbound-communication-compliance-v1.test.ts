import { describe, expect, it } from 'vitest';

import {
  evaluateOutboundCommunicationComplianceV1,
  parseOutboundCommunicationComplianceFixtureV1,
  type OutboundCommunicationComplianceFixtureV1,
} from './outbound-communication-compliance-v1.js';

function makeFixture(
  overrides: Partial<OutboundCommunicationComplianceFixtureV1> = {},
): OutboundCommunicationComplianceFixtureV1 {
  return {
    schemaVersion: 1,
    channel: 'email',
    purpose: 'growth-outreach',
    workspaceTimezone: 'Australia/Sydney',
    nowIso: '2026-05-04T01:30:00.000Z',
    recipients: [
      {
        recipientId: 'contact-1',
        partyId: 'party-1',
        timezone: 'Australia/Sydney',
        jurisdiction: 'AU-NSW',
        consent: { optInStatus: 'opted_in', capturedAtIso: '2026-04-01T00:00:00.000Z' },
      },
    ],
    ...overrides,
  };
}

describe('outbound communication compliance', () => {
  it('allows opted-in recipients inside the workspace business window', () => {
    const evaluation = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        rules: {
          businessWindow: {
            daysOfWeek: [1, 2, 3, 4, 5],
            startLocalTime: '09:00',
            endLocalTime: '17:00',
          },
        },
      }),
    );

    expect(evaluation.decision).toBe('Allow');
  });

  it('blocks outbound sends for opted-out consent', () => {
    const evaluation = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        recipients: [
          {
            recipientId: 'contact-opted-out',
            consent: { optInStatus: 'opted_out' },
          },
        ],
      }),
    );

    expect(evaluation.decision).toBe('Block');
    expect(evaluation.rationales).toContainEqual(
      expect.objectContaining({
        code: 'consent.not_opted_in',
        recipientId: 'contact-opted-out',
      }),
    );
  });

  it('blocks active suppression entries and ignores expired ones', () => {
    const evaluation = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        nowIso: '2026-05-04T01:30:00.000Z',
        recipients: [
          {
            recipientId: 'contact-suppressed',
            consent: {
              optInStatus: 'opted_in',
              suppressionEntries: [
                {
                  listName: 'global-unsubscribe',
                  addedAtIso: '2026-05-01T00:00:00.000Z',
                },
                {
                  listName: 'expired-campaign-hold',
                  addedAtIso: '2026-04-01T00:00:00.000Z',
                  expiresAtIso: '2026-04-02T00:00:00.000Z',
                },
              ],
            },
          },
        ],
      }),
    );

    expect(evaluation.decision).toBe('Block');
    expect(evaluation.rationales.filter((r) => r.code === 'suppression.active')).toHaveLength(1);
  });

  it('defers sends during recipient quiet hours with a deterministic UTC resume time', () => {
    const evaluation = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        nowIso: '2026-05-04T11:30:00.000Z',
        recipients: [
          {
            recipientId: 'contact-ny',
            timezone: 'America/New_York',
            consent: { optInStatus: 'opted_in' },
          },
        ],
        rules: {
          quietHours: [{ startLocalTime: '20:00', endLocalTime: '08:00' }],
        },
      }),
    );

    expect(evaluation.decision).toBe('Defer');
    expect(evaluation.deferredUntilIso).toBe('2026-05-04T12:00:00.000Z');
    expect(evaluation.rationales).toContainEqual(
      expect.objectContaining({
        code: 'quiet_hours.defer',
        recipientId: 'contact-ny',
        deferredUntilIso: '2026-05-04T12:00:00.000Z',
      }),
    );
  });

  it('defers sends outside the recipient business window', () => {
    const evaluation = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        nowIso: '2026-05-03T22:00:00.000Z',
        recipients: [
          {
            recipientId: 'contact-london',
            timezone: 'Europe/London',
            consent: { optInStatus: 'opted_in' },
          },
        ],
        rules: {
          businessWindow: {
            daysOfWeek: [1, 2, 3, 4, 5],
            startLocalTime: '09:00',
            endLocalTime: '17:00',
          },
        },
      }),
    );

    expect(evaluation.decision).toBe('Defer');
    expect(evaluation.deferredUntilIso).toBe('2026-05-04T08:00:00.000Z');
  });

  it('escalates jurisdiction rules to HumanApprove or ManualOnly', () => {
    const humanApprove = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        recipients: [
          {
            recipientId: 'contact-ca',
            jurisdiction: 'US-CA',
            consent: { optInStatus: 'opted_in' },
          },
        ],
        rules: {
          jurisdictionRules: [
            {
              jurisdiction: 'US-CA',
              channel: 'email',
              effect: 'HumanApprove',
              rationale: 'California cold outreach requires operator review.',
            },
          ],
        },
      }),
    );

    const manualOnly = evaluateOutboundCommunicationComplianceV1(
      makeFixture({
        recipients: [
          {
            recipientId: 'contact-eu',
            jurisdiction: 'EU-DE',
            consent: { optInStatus: 'opted_in' },
          },
        ],
        rules: {
          jurisdictionRules: [
            {
              jurisdiction: 'EU-DE',
              channel: 'email',
              effect: 'ManualOnly',
              rationale: 'Manual legal review is required for this jurisdiction.',
            },
          ],
        },
      }),
    );

    expect(humanApprove.decision).toBe('HumanApprove');
    expect(manualOnly.decision).toBe('ManualOnly');
  });

  it('parses deterministic fake fixture payloads from action parameters', () => {
    const fixture = parseOutboundCommunicationComplianceFixtureV1({
      schemaVersion: 1,
      channel: 'email',
      purpose: 'micro-saas-trial-nurture',
      workspaceTimezone: 'UTC',
      nowIso: '2026-05-04T10:00:00.000Z',
      recipients: [
        {
          recipientId: 'lead-1',
          timezone: 'UTC',
          consent: { optInStatus: 'opted_in' },
        },
      ],
      rules: {
        businessWindow: {
          daysOfWeek: ['1', '2', '3', '4', '5'],
          startLocalTime: '09:00',
          endLocalTime: '17:00',
        },
      },
    });

    expect(fixture.purpose).toBe('micro-saas-trial-nurture');
    expect(fixture.rules?.businessWindow?.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});
