import type { ConsentOptInStatus, ConsentSuppressionEntryV1 } from '../canonical/index.js';
import {
  readEnum,
  readIsoString,
  readOptionalIsoString,
  readOptionalRecordField,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

const OUTBOUND_CHANNELS = [
  'email',
  'sms',
  'push',
  'phone',
  'in_app',
  'postal',
  'social',
  'web',
] as const;
export type OutboundCommunicationChannelV1 = (typeof OUTBOUND_CHANNELS)[number];

const CONSENT_STATUSES = [
  'opted_in',
  'opted_out',
  'pending_double_opt_in',
  'unknown',
] as const satisfies readonly ConsentOptInStatus[];

const RULE_EFFECTS = ['HumanApprove', 'ManualOnly', 'Block'] as const;
type OutboundCommunicationRuleEffectV1 = (typeof RULE_EFFECTS)[number];

export type OutboundComplianceDecisionV1 =
  | 'Allow'
  | 'Defer'
  | 'HumanApprove'
  | 'ManualOnly'
  | 'Block';

export type LocalTimeWindowV1 = Readonly<{
  startLocalTime: string;
  endLocalTime: string;
}>;

export type BusinessWindowV1 = LocalTimeWindowV1 &
  Readonly<{
    daysOfWeek: readonly number[];
  }>;

export type OutboundJurisdictionRuleV1 = Readonly<{
  jurisdiction: string;
  channel?: OutboundCommunicationChannelV1;
  effect: OutboundCommunicationRuleEffectV1;
  rationale: string;
}>;

export type OutboundConsentSnapshotV1 = Readonly<{
  optInStatus: ConsentOptInStatus;
  capturedAtIso?: string;
  revokedAtIso?: string;
  suppressionEntries?: readonly ConsentSuppressionEntryV1[];
}>;

export type OutboundRecipientSnapshotV1 = Readonly<{
  recipientId: string;
  partyId?: string;
  timezone?: string;
  jurisdiction?: string;
  consent?: OutboundConsentSnapshotV1;
}>;

export type OutboundCommunicationRulesV1 = Readonly<{
  quietHours?: readonly LocalTimeWindowV1[];
  businessWindow?: BusinessWindowV1;
  jurisdictionRules?: readonly OutboundJurisdictionRuleV1[];
}>;

export type OutboundCommunicationComplianceFixtureV1 = Readonly<{
  schemaVersion: 1;
  channel: OutboundCommunicationChannelV1;
  purpose: string;
  workspaceTimezone: string;
  nowIso: string;
  recipients: readonly OutboundRecipientSnapshotV1[];
  rules?: OutboundCommunicationRulesV1;
}>;

export type OutboundComplianceRationaleV1 = Readonly<{
  code:
    | 'consent.opted_in'
    | 'consent.missing'
    | 'consent.not_opted_in'
    | 'consent.revoked'
    | 'suppression.active'
    | 'quiet_hours.defer'
    | 'business_window.defer'
    | 'jurisdiction.human_approve'
    | 'jurisdiction.manual_only'
    | 'jurisdiction.block';
  message: string;
  recipientId?: string;
  deferredUntilIso?: string;
}>;

export type OutboundCommunicationComplianceEvaluationV1 = Readonly<{
  decision: OutboundComplianceDecisionV1;
  channel: OutboundCommunicationChannelV1;
  purpose: string;
  rationales: readonly OutboundComplianceRationaleV1[];
  deferredUntilIso?: string;
}>;

export class OutboundCommunicationComplianceParseError extends Error {
  public override readonly name = 'OutboundCommunicationComplianceParseError';

  public constructor(message: string) {
    super(message);
  }
}

const E = OutboundCommunicationComplianceParseError;

const DECISION_RANK: Readonly<Record<OutboundComplianceDecisionV1, number>> = {
  Allow: 0,
  HumanApprove: 1,
  Defer: 2,
  ManualOnly: 3,
  Block: 4,
};

const WEEKDAY_TO_NUMBER: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function parseOutboundCommunicationComplianceFixtureV1(
  value: unknown,
): OutboundCommunicationComplianceFixtureV1 {
  const record = readRecord(value, 'OutboundCommunicationComplianceFixture', E);
  const schemaVersion = record['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new E('schemaVersion must be 1.');
  }

  const channel = readEnum(record, 'channel', OUTBOUND_CHANNELS, E);
  const purpose = readString(record, 'purpose', E);
  const workspaceTimezone = readString(record, 'workspaceTimezone', E);
  const nowIso = readIsoString(record, 'nowIso', E);
  const recipients = parseRecipients(record['recipients']);
  const rules = parseOptionalRules(record['rules']);

  assertValidTimezone(workspaceTimezone, 'workspaceTimezone');
  validateFixtureTimeZones(recipients);

  return {
    schemaVersion: 1,
    channel,
    purpose,
    workspaceTimezone,
    nowIso,
    recipients,
    ...(rules ? { rules } : {}),
  };
}

export function evaluateOutboundCommunicationComplianceV1(
  fixture: OutboundCommunicationComplianceFixtureV1,
): OutboundCommunicationComplianceEvaluationV1 {
  const now = new Date(fixture.nowIso);
  const rationales: OutboundComplianceRationaleV1[] = [];
  let decision: OutboundComplianceDecisionV1 = 'Allow';
  let deferredUntilIso: string | undefined;

  for (const recipient of fixture.recipients) {
    const recipientResult = evaluateRecipient(fixture, recipient, now);
    rationales.push(...recipientResult.rationales);
    decision = strongestDecision(decision, recipientResult.decision);
    deferredUntilIso = laterIso(deferredUntilIso, recipientResult.deferredUntilIso);
  }

  if (rationales.length === 0) {
    rationales.push({
      code: 'consent.opted_in',
      message: `All recipients are allowed on ${fixture.channel} for ${fixture.purpose}.`,
    });
  }

  return {
    decision,
    channel: fixture.channel,
    purpose: fixture.purpose,
    rationales,
    ...(deferredUntilIso ? { deferredUntilIso } : {}),
  };
}

function evaluateRecipient(
  fixture: OutboundCommunicationComplianceFixtureV1,
  recipient: OutboundRecipientSnapshotV1,
  now: Date,
): OutboundCommunicationComplianceEvaluationV1 {
  const rationales: OutboundComplianceRationaleV1[] = [];
  let decision: OutboundComplianceDecisionV1 = 'Allow';

  const consent = recipient.consent;
  if (!consent) {
    rationales.push({
      code: 'consent.missing',
      recipientId: recipient.recipientId,
      message: `Recipient ${recipient.recipientId} has no ${fixture.channel} consent snapshot for ${fixture.purpose}.`,
    });
    decision = strongestDecision(decision, 'HumanApprove');
  } else {
    const consentDecision = evaluateConsent(fixture, recipient, consent, now);
    rationales.push(...consentDecision.rationales);
    decision = strongestDecision(decision, consentDecision.decision);
  }

  const windowDecision = evaluateTimeWindows(fixture, recipient, now);
  rationales.push(...windowDecision.rationales);
  decision = strongestDecision(decision, windowDecision.decision);
  const deferredUntilIso = windowDecision.deferredUntilIso;

  const jurisdictionDecision = evaluateJurisdictionRules(fixture, recipient);
  rationales.push(...jurisdictionDecision.rationales);
  decision = strongestDecision(decision, jurisdictionDecision.decision);

  return {
    decision,
    channel: fixture.channel,
    purpose: fixture.purpose,
    rationales,
    ...(deferredUntilIso ? { deferredUntilIso } : {}),
  };
}

function evaluateConsent(
  fixture: OutboundCommunicationComplianceFixtureV1,
  recipient: OutboundRecipientSnapshotV1,
  consent: OutboundConsentSnapshotV1,
  now: Date,
): OutboundCommunicationComplianceEvaluationV1 {
  const rationales: OutboundComplianceRationaleV1[] = [];
  let decision: OutboundComplianceDecisionV1 = 'Allow';

  if (consent.revokedAtIso && new Date(consent.revokedAtIso) <= now) {
    rationales.push({
      code: 'consent.revoked',
      recipientId: recipient.recipientId,
      message: `Recipient ${recipient.recipientId} has revoked ${fixture.channel} consent.`,
    });
    decision = strongestDecision(decision, 'Block');
  } else if (consent.optInStatus === 'opted_out') {
    rationales.push({
      code: 'consent.not_opted_in',
      recipientId: recipient.recipientId,
      message: `Recipient ${recipient.recipientId} is opted out for ${fixture.channel}.`,
    });
    decision = strongestDecision(decision, 'Block');
  } else if (consent.optInStatus === 'pending_double_opt_in' || consent.optInStatus === 'unknown') {
    rationales.push({
      code: 'consent.not_opted_in',
      recipientId: recipient.recipientId,
      message: `Recipient ${recipient.recipientId} consent status is ${consent.optInStatus}.`,
    });
    decision = strongestDecision(decision, 'HumanApprove');
  }

  for (const entry of consent.suppressionEntries ?? []) {
    if (!entry.expiresAtIso || new Date(entry.expiresAtIso) > now) {
      rationales.push({
        code: 'suppression.active',
        recipientId: recipient.recipientId,
        message: `Recipient ${recipient.recipientId} is on suppression list ${entry.listName}.`,
      });
      decision = strongestDecision(decision, 'Block');
    }
  }

  return {
    decision,
    channel: fixture.channel,
    purpose: fixture.purpose,
    rationales,
  };
}

function evaluateTimeWindows(
  fixture: OutboundCommunicationComplianceFixtureV1,
  recipient: OutboundRecipientSnapshotV1,
  now: Date,
): OutboundCommunicationComplianceEvaluationV1 {
  const rationales: OutboundComplianceRationaleV1[] = [];
  let decision: OutboundComplianceDecisionV1 = 'Allow';
  let deferredUntilIso: string | undefined;
  const timezone = recipient.timezone ?? fixture.workspaceTimezone;
  const local = localParts(now, timezone);

  for (const quietWindow of fixture.rules?.quietHours ?? []) {
    if (isMinuteInWindow(local.minuteOfDay, quietWindow)) {
      const nextAllowed = findNextAllowedIso(fixture, recipient, now);
      rationales.push({
        code: 'quiet_hours.defer',
        recipientId: recipient.recipientId,
        deferredUntilIso: nextAllowed,
        message: `Recipient ${recipient.recipientId} is inside quiet hours in ${timezone}.`,
      });
      decision = strongestDecision(decision, 'Defer');
      deferredUntilIso = laterIso(deferredUntilIso, nextAllowed);
      break;
    }
  }

  const businessWindow = fixture.rules?.businessWindow;
  if (businessWindow && !isWithinBusinessWindow(local, businessWindow)) {
    const nextAllowed = findNextAllowedIso(fixture, recipient, now);
    rationales.push({
      code: 'business_window.defer',
      recipientId: recipient.recipientId,
      deferredUntilIso: nextAllowed,
      message: `Recipient ${recipient.recipientId} is outside the business window in ${timezone}.`,
    });
    decision = strongestDecision(decision, 'Defer');
    deferredUntilIso = laterIso(deferredUntilIso, nextAllowed);
  }

  return {
    decision,
    channel: fixture.channel,
    purpose: fixture.purpose,
    rationales,
    ...(deferredUntilIso ? { deferredUntilIso } : {}),
  };
}

function evaluateJurisdictionRules(
  fixture: OutboundCommunicationComplianceFixtureV1,
  recipient: OutboundRecipientSnapshotV1,
): OutboundCommunicationComplianceEvaluationV1 {
  const rationales: OutboundComplianceRationaleV1[] = [];
  let decision: OutboundComplianceDecisionV1 = 'Allow';
  if (!recipient.jurisdiction) {
    return {
      decision,
      channel: fixture.channel,
      purpose: fixture.purpose,
      rationales,
    };
  }

  for (const rule of fixture.rules?.jurisdictionRules ?? []) {
    if (rule.jurisdiction !== recipient.jurisdiction) continue;
    if (rule.channel && rule.channel !== fixture.channel) continue;

    const code =
      rule.effect === 'HumanApprove'
        ? 'jurisdiction.human_approve'
        : rule.effect === 'ManualOnly'
          ? 'jurisdiction.manual_only'
          : 'jurisdiction.block';
    rationales.push({
      code,
      recipientId: recipient.recipientId,
      message: `Recipient ${recipient.recipientId} jurisdiction ${recipient.jurisdiction}: ${rule.rationale}`,
    });
    decision = strongestDecision(
      decision,
      rule.effect === 'HumanApprove'
        ? 'HumanApprove'
        : rule.effect === 'ManualOnly'
          ? 'ManualOnly'
          : 'Block',
    );
  }

  return {
    decision,
    channel: fixture.channel,
    purpose: fixture.purpose,
    rationales,
  };
}

function findNextAllowedIso(
  fixture: OutboundCommunicationComplianceFixtureV1,
  recipient: OutboundRecipientSnapshotV1,
  now: Date,
): string {
  const maxMinutes = 14 * 24 * 60;
  for (let minutes = 1; minutes <= maxMinutes; minutes++) {
    const candidate = new Date(now.getTime() + minutes * 60_000);
    const local = localParts(candidate, recipient.timezone ?? fixture.workspaceTimezone);
    const quiet = (fixture.rules?.quietHours ?? []).some((window) =>
      isMinuteInWindow(local.minuteOfDay, window),
    );
    const businessWindow = fixture.rules?.businessWindow;
    const inBusinessWindow = !businessWindow || isWithinBusinessWindow(local, businessWindow);
    if (!quiet && inBusinessWindow) {
      return candidate.toISOString();
    }
  }
  return new Date(now.getTime() + maxMinutes * 60_000).toISOString();
}

function localParts(
  instant: Date,
  timezone: string,
): Readonly<{ dayOfWeek: number; minuteOfDay: number }> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(instant);
  const weekday = readPart(parts, 'weekday');
  const hour = Number(readPart(parts, 'hour'));
  const minute = Number(readPart(parts, 'minute'));
  const dayOfWeek = WEEKDAY_TO_NUMBER[weekday];
  if (dayOfWeek === undefined || !Number.isSafeInteger(hour) || !Number.isSafeInteger(minute)) {
    throw new E(`Unable to evaluate local time for ${timezone}.`);
  }
  return { dayOfWeek, minuteOfDay: hour * 60 + minute };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) throw new E(`Intl formatter did not return ${type}.`);
  return part.value;
}

function isWithinBusinessWindow(
  local: Readonly<{ dayOfWeek: number; minuteOfDay: number }>,
  window: BusinessWindowV1,
): boolean {
  return window.daysOfWeek.includes(local.dayOfWeek) && isMinuteInWindow(local.minuteOfDay, window);
}

function isMinuteInWindow(minuteOfDay: number, window: LocalTimeWindowV1): boolean {
  const start = parseLocalTime(window.startLocalTime);
  const end = parseLocalTime(window.endLocalTime);
  if (start === end) return true;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

function parseRecipients(value: unknown): readonly OutboundRecipientSnapshotV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new E('recipients must be a non-empty array.');
  }
  return value.map((recipient, index) => parseRecipient(recipient, `recipients[${index}]`));
}

function parseRecipient(value: unknown, path: string): OutboundRecipientSnapshotV1 {
  const record = readRecord(value, path, E);
  const recipientId = readString(record, 'recipientId', E, { path });
  const partyId = readOptionalString(record, 'partyId', E, { path });
  const timezone = readOptionalString(record, 'timezone', E, { path });
  const jurisdiction = readOptionalString(record, 'jurisdiction', E, { path });
  const consentRecord = readOptionalRecordField(record, 'consent', E);
  const consent = consentRecord ? parseConsent(consentRecord, `${path}.consent`) : undefined;

  return {
    recipientId,
    ...(partyId ? { partyId } : {}),
    ...(timezone ? { timezone } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(consent ? { consent } : {}),
  };
}

function parseConsent(record: Record<string, unknown>, _path: string): OutboundConsentSnapshotV1 {
  const optInStatus = readEnum(record, 'optInStatus', CONSENT_STATUSES, E);
  const capturedAtIso = readOptionalIsoString(record, 'capturedAtIso', E);
  const revokedAtIso = readOptionalIsoString(record, 'revokedAtIso', E);
  const suppressionEntries = parseOptionalSuppressionEntries(record['suppressionEntries']);
  return {
    optInStatus,
    ...(capturedAtIso ? { capturedAtIso } : {}),
    ...(revokedAtIso ? { revokedAtIso } : {}),
    ...(suppressionEntries ? { suppressionEntries } : {}),
  };
}

function parseOptionalSuppressionEntries(
  value: unknown,
): readonly ConsentSuppressionEntryV1[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new E('suppressionEntries must be an array when provided.');
  }
  return value.map((entry, index) => {
    const record = readRecord(entry, `suppressionEntries[${index}]`, E);
    const listName = readString(record, 'listName', E);
    const addedAtIso = readIsoString(record, 'addedAtIso', E);
    const reason = readOptionalString(record, 'reason', E);
    const expiresAtIso = readOptionalIsoString(record, 'expiresAtIso', E);
    return {
      listName,
      addedAtIso,
      ...(reason ? { reason } : {}),
      ...(expiresAtIso ? { expiresAtIso } : {}),
    };
  });
}

function parseOptionalRules(value: unknown): OutboundCommunicationRulesV1 | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value, 'rules', E);
  const quietHours = parseOptionalLocalTimeWindows(record['quietHours'], 'quietHours');
  const businessWindowRecord = readOptionalRecordField(record, 'businessWindow', E);
  const businessWindow = businessWindowRecord
    ? parseBusinessWindow(businessWindowRecord)
    : undefined;
  const jurisdictionRules = parseOptionalJurisdictionRules(record['jurisdictionRules']);
  return {
    ...(quietHours ? { quietHours } : {}),
    ...(businessWindow ? { businessWindow } : {}),
    ...(jurisdictionRules ? { jurisdictionRules } : {}),
  };
}

function parseOptionalLocalTimeWindows(
  value: unknown,
  path: string,
): readonly LocalTimeWindowV1[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new E(`${path} must be an array when provided.`);
  }
  return value.map((item, index) => parseLocalTimeWindow(item, `${path}[${index}]`));
}

function parseLocalTimeWindow(value: unknown, path: string): LocalTimeWindowV1 {
  const record = readRecord(value, path, E);
  const startLocalTime = readString(record, 'startLocalTime', E, { path });
  const endLocalTime = readString(record, 'endLocalTime', E, { path });
  parseLocalTime(startLocalTime);
  parseLocalTime(endLocalTime);
  return { startLocalTime, endLocalTime };
}

function parseBusinessWindow(record: Record<string, unknown>): BusinessWindowV1 {
  const window = parseLocalTimeWindow(record, 'businessWindow');
  const daysOfWeek = readStringArray(record, 'daysOfWeek', E, { minLength: 1 }).map((day) => {
    const parsed = Number(day);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 7) {
      throw new E('daysOfWeek values must be strings containing integers 1 through 7.');
    }
    return parsed;
  });
  return { ...window, daysOfWeek };
}

function parseOptionalJurisdictionRules(
  value: unknown,
): readonly OutboundJurisdictionRuleV1[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new E('jurisdictionRules must be an array when provided.');
  }
  return value.map((item, index) => {
    const path = `jurisdictionRules[${index}]`;
    const record = readRecord(item, path, E);
    const jurisdiction = readString(record, 'jurisdiction', E, { path });
    const channel = record['channel']
      ? readEnum(record, 'channel', OUTBOUND_CHANNELS, E)
      : undefined;
    const effect = readEnum(record, 'effect', RULE_EFFECTS, E);
    const rationale = readString(record, 'rationale', E, { path });
    return {
      jurisdiction,
      ...(channel ? { channel } : {}),
      effect,
      rationale,
    };
  });
}

function parseLocalTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new E('local time values must use HH:mm 24-hour format.');
  return Number(match[1]) * 60 + Number(match[2]);
}

function assertValidTimezone(timezone: string, label: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new E(`${label} must be a valid IANA timezone.`);
  }
}

function validateFixtureTimeZones(recipients: readonly OutboundRecipientSnapshotV1[]): void {
  for (const recipient of recipients) {
    if (recipient.timezone) {
      assertValidTimezone(recipient.timezone, `recipient ${recipient.recipientId} timezone`);
    }
  }
}

function strongestDecision(
  current: OutboundComplianceDecisionV1,
  candidate: OutboundComplianceDecisionV1,
): OutboundComplianceDecisionV1 {
  return DECISION_RANK[candidate] > DECISION_RANK[current] ? candidate : current;
}

function laterIso(current: string | undefined, candidate: string | undefined): string | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate) > new Date(current) ? candidate : current;
}
