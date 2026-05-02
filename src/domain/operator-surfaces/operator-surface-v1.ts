import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  MachineId,
  OperatorSurfaceId,
  RunId,
  UserId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type CorrelationId as CorrelationIdType,
  type EvidenceId as EvidenceIdType,
  type MachineId as MachineIdType,
  type OperatorSurfaceId as OperatorSurfaceIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readEnum,
  readIsoString,
  readOptionalBoolean,
  readOptionalIsoString,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readRecordField,
  readString,
  readInteger,
} from '../validation/parse-utils.js';

export const OPERATOR_SURFACE_SCHEMA_VERSION = 1 as const;

const SURFACE_KINDS = ['Card', 'Form', 'Panel'] as const;
const BLOCK_TYPES = ['text', 'keyValueList', 'metric', 'form', 'actions'] as const;
const FIELD_WIDGETS = ['text', 'textarea', 'select', 'checkbox', 'number'] as const;
const INTENT_KINDS = ['Intent', 'Taste', 'Insight'] as const;
const LIFECYCLE_STATUSES = ['Proposed', 'Approved', 'Rendered', 'Used'] as const;
const TEXT_TONES = ['neutral', 'info', 'warning', 'success', 'critical'] as const;
const EXECUTABLE_KEYS = new Set([
  'code',
  'dangerouslySetInnerHTML',
  'html',
  'iframeUrl',
  'onClick',
  'script',
  'scriptUrl',
]);
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ROOT_KEYS = [
  'schemaVersion',
  'surfaceId',
  'workspaceId',
  'correlationId',
  'surfaceKind',
  'context',
  'title',
  'description',
  'attribution',
  'lifecycle',
  'blocks',
] as const;
const RUN_CONTEXT_KEYS = ['kind', 'runId'] as const;
const APPROVAL_CONTEXT_KEYS = ['kind', 'runId', 'approvalId'] as const;
const ATTRIBUTION_KEYS = ['proposedBy', 'proposedAtIso', 'rationale'] as const;
const MACHINE_ACTOR_KEYS = ['kind', 'machineId'] as const;
const USER_ACTOR_KEYS = ['kind', 'userId'] as const;
const SYSTEM_ACTOR_KEYS = ['kind'] as const;
const LIFECYCLE_KEYS = [
  'status',
  'proposedAtIso',
  'approvedAtIso',
  'approvedByUserId',
  'renderedAtIso',
  'renderedByUserId',
  'usedAtIso',
  'usedByUserId',
  'evidenceIds',
] as const;
const TEXT_BLOCK_KEYS = ['blockType', 'text', 'tone'] as const;
const KEY_VALUE_LIST_BLOCK_KEYS = ['blockType', 'items'] as const;
const KEY_VALUE_ITEM_KEYS = ['label', 'value'] as const;
const METRIC_BLOCK_KEYS = ['blockType', 'label', 'value', 'unit', 'tone'] as const;
const FORM_BLOCK_KEYS = ['blockType', 'fields'] as const;
const FIELD_KEYS = [
  'fieldId',
  'label',
  'widget',
  'required',
  'helpText',
  'placeholder',
  'options',
] as const;
const SELECT_OPTION_KEYS = ['value', 'label'] as const;
const ACTIONS_BLOCK_KEYS = ['blockType', 'actions'] as const;
const ACTION_KEYS = ['actionId', 'label', 'intentKind', 'submitsForm'] as const;
const INTERACTION_KEYS = [
  'schemaVersion',
  'surfaceId',
  'workspaceId',
  'runId',
  'approvalId',
  'actionId',
  'intentKind',
  'submittedByUserId',
  'submittedAtIso',
  'values',
] as const;

export type OperatorSurfaceKind = (typeof SURFACE_KINDS)[number];
export type OperatorSurfaceBlockType = (typeof BLOCK_TYPES)[number];
export type OperatorSurfaceFieldWidget = (typeof FIELD_WIDGETS)[number];
export type OperatorSurfaceIntentKind = (typeof INTENT_KINDS)[number];
export type OperatorSurfaceLifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type OperatorSurfaceTextTone = (typeof TEXT_TONES)[number];

export type OperatorSurfaceContextV1 =
  | Readonly<{ kind: 'Run'; runId: RunIdType }>
  | Readonly<{ kind: 'Approval'; runId: RunIdType; approvalId: ApprovalIdType }>;

export type OperatorSurfaceActorV1 =
  | Readonly<{ kind: 'Machine'; machineId: MachineIdType }>
  | Readonly<{ kind: 'User'; userId: UserIdType }>
  | Readonly<{ kind: 'System' }>;

export type OperatorSurfaceAttributionV1 = Readonly<{
  proposedBy: OperatorSurfaceActorV1;
  proposedAtIso: string;
  rationale: string;
}>;

export type OperatorSurfaceLifecycleV1 = Readonly<{
  status: OperatorSurfaceLifecycleStatus;
  proposedAtIso: string;
  approvedAtIso?: string;
  approvedByUserId?: UserIdType;
  renderedAtIso?: string;
  renderedByUserId?: UserIdType;
  usedAtIso?: string;
  usedByUserId?: UserIdType;
  evidenceIds?: readonly EvidenceIdType[];
}>;

export type OperatorSurfaceTextBlockV1 = Readonly<{
  blockType: 'text';
  text: string;
  tone?: OperatorSurfaceTextTone;
}>;

export type OperatorSurfaceKeyValueItemV1 = Readonly<{
  label: string;
  value: string;
}>;

export type OperatorSurfaceKeyValueListBlockV1 = Readonly<{
  blockType: 'keyValueList';
  items: readonly OperatorSurfaceKeyValueItemV1[];
}>;

export type OperatorSurfaceMetricBlockV1 = Readonly<{
  blockType: 'metric';
  label: string;
  value: string;
  unit?: string;
  tone?: OperatorSurfaceTextTone;
}>;

export type OperatorSurfaceSelectOptionV1 = Readonly<{
  value: string;
  label: string;
}>;

export type OperatorSurfaceFieldV1 = Readonly<{
  fieldId: string;
  label: string;
  widget: OperatorSurfaceFieldWidget;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: readonly OperatorSurfaceSelectOptionV1[];
}>;

export type OperatorSurfaceFormBlockV1 = Readonly<{
  blockType: 'form';
  fields: readonly OperatorSurfaceFieldV1[];
}>;

export type OperatorSurfaceActionV1 = Readonly<{
  actionId: string;
  label: string;
  intentKind: OperatorSurfaceIntentKind;
  submitsForm?: boolean;
}>;

export type OperatorSurfaceActionsBlockV1 = Readonly<{
  blockType: 'actions';
  actions: readonly OperatorSurfaceActionV1[];
}>;

export type OperatorSurfaceBlockV1 =
  | OperatorSurfaceTextBlockV1
  | OperatorSurfaceKeyValueListBlockV1
  | OperatorSurfaceMetricBlockV1
  | OperatorSurfaceFormBlockV1
  | OperatorSurfaceActionsBlockV1;

export type OperatorSurfaceV1 = Readonly<{
  schemaVersion: 1;
  surfaceId: OperatorSurfaceIdType;
  workspaceId: WorkspaceIdType;
  correlationId: CorrelationIdType;
  surfaceKind: OperatorSurfaceKind;
  context: OperatorSurfaceContextV1;
  title: string;
  description?: string;
  attribution: OperatorSurfaceAttributionV1;
  lifecycle: OperatorSurfaceLifecycleV1;
  blocks: readonly OperatorSurfaceBlockV1[];
}>;

export type OperatorSurfaceInteractionV1 = Readonly<{
  schemaVersion: 1;
  surfaceId: OperatorSurfaceIdType;
  workspaceId: WorkspaceIdType;
  runId: RunIdType;
  approvalId?: ApprovalIdType;
  actionId: string;
  intentKind: OperatorSurfaceIntentKind;
  submittedByUserId: UserIdType;
  submittedAtIso: string;
  values: Readonly<Record<string, string | number | boolean>>;
}>;

export class OperatorSurfaceParseError extends Error {
  public override readonly name = 'OperatorSurfaceParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseOperatorSurfaceV1(value: unknown): OperatorSurfaceV1 {
  assertNoExecutableFields(value, 'operatorSurface');
  const record = readRecord(value, 'OperatorSurfaceV1', OperatorSurfaceParseError);
  assertOnlyAllowedKeys(record, ROOT_KEYS, 'operatorSurface');
  const schemaVersion = readInteger(record, 'schemaVersion', OperatorSurfaceParseError);
  if (schemaVersion !== OPERATOR_SURFACE_SCHEMA_VERSION) {
    throw new OperatorSurfaceParseError(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }

  const context = parseContext(readRecordField(record, 'context', OperatorSurfaceParseError));
  const attribution = parseAttribution(
    readRecordField(record, 'attribution', OperatorSurfaceParseError),
  );
  const lifecycle = parseLifecycle(readRecordField(record, 'lifecycle', OperatorSurfaceParseError));
  if (lifecycle.proposedAtIso !== attribution.proposedAtIso) {
    throw new OperatorSurfaceParseError('lifecycle.proposedAtIso must match attribution.');
  }

  const blocksRaw = record['blocks'];
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new OperatorSurfaceParseError('blocks must be a non-empty array.');
  }
  const blocks = blocksRaw.map((block, index) => parseBlock(block, `blocks[${String(index)}]`));
  validateUniqueSurfaceIds(blocks);
  const description = readOptionalString(record, 'description', OperatorSurfaceParseError);

  return deepFreezeSurface({
    schemaVersion: 1,
    surfaceId: OperatorSurfaceId(readString(record, 'surfaceId', OperatorSurfaceParseError)),
    workspaceId: WorkspaceId(readString(record, 'workspaceId', OperatorSurfaceParseError)),
    correlationId: CorrelationId(readString(record, 'correlationId', OperatorSurfaceParseError)),
    surfaceKind: readEnum(record, 'surfaceKind', SURFACE_KINDS, OperatorSurfaceParseError),
    context,
    title: readString(record, 'title', OperatorSurfaceParseError),
    ...(description !== undefined ? { description } : {}),
    attribution,
    lifecycle,
    blocks,
  });
}

export function parseOperatorSurfaceInteractionV1(
  surface: OperatorSurfaceV1,
  value: unknown,
): OperatorSurfaceInteractionV1 {
  assertNoExecutableFields(value, 'operatorSurfaceInteraction');
  if (surface.lifecycle.status !== 'Approved' && surface.lifecycle.status !== 'Rendered') {
    throw new OperatorSurfaceParseError('Only approved or rendered operator surfaces can be used.');
  }

  const record = readRecord(value, 'OperatorSurfaceInteractionV1', OperatorSurfaceParseError);
  assertOnlyAllowedKeys(record, INTERACTION_KEYS, 'operatorSurfaceInteraction');
  const schemaVersion = readInteger(record, 'schemaVersion', OperatorSurfaceParseError);
  if (schemaVersion !== OPERATOR_SURFACE_SCHEMA_VERSION) {
    throw new OperatorSurfaceParseError(`Unsupported schemaVersion: ${String(schemaVersion)}`);
  }

  const actionId = readString(record, 'actionId', OperatorSurfaceParseError);
  const action = findAction(surface, actionId);
  if (action === undefined) {
    throw new OperatorSurfaceParseError(
      'actionId must reference an action declared by the surface.',
    );
  }

  const surfaceId = OperatorSurfaceId(readString(record, 'surfaceId', OperatorSurfaceParseError));
  if (surfaceId !== surface.surfaceId) {
    throw new OperatorSurfaceParseError('surfaceId must match the approved operator surface.');
  }
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', OperatorSurfaceParseError));
  if (workspaceId !== surface.workspaceId) {
    throw new OperatorSurfaceParseError('workspaceId must match the approved operator surface.');
  }
  const runId = RunId(readString(record, 'runId', OperatorSurfaceParseError));
  if (runId !== surface.context.runId) {
    throw new OperatorSurfaceParseError('runId must match the approved operator surface context.');
  }
  const approvalIdRaw = readOptionalString(record, 'approvalId', OperatorSurfaceParseError);
  if (surface.context.kind === 'Run' && approvalIdRaw !== undefined) {
    throw new OperatorSurfaceParseError('Run-scoped interactions must not include approvalId.');
  }
  if (
    surface.context.kind === 'Approval' &&
    approvalIdRaw !== undefined &&
    ApprovalId(approvalIdRaw) !== surface.context.approvalId
  ) {
    throw new OperatorSurfaceParseError(
      'approvalId must match the approved operator surface context.',
    );
  }

  const submittedAtIso = readIsoString(record, 'submittedAtIso', OperatorSurfaceParseError);
  assertNotBefore(surface.lifecycle.proposedAtIso, submittedAtIso, OperatorSurfaceParseError, {
    anchorLabel: 'surface.lifecycle.proposedAtIso',
    laterLabel: 'submittedAtIso',
  });

  const approvalId =
    surface.context.kind === 'Approval' ? { approvalId: surface.context.approvalId } : {};

  return deepFreezeInteraction({
    schemaVersion: 1,
    surfaceId,
    workspaceId,
    runId,
    ...approvalId,
    actionId,
    intentKind: action.intentKind,
    submittedByUserId: UserId(readString(record, 'submittedByUserId', OperatorSurfaceParseError)),
    submittedAtIso,
    values: parseInteractionValues(
      surface,
      action,
      readRecordField(record, 'values', OperatorSurfaceParseError),
    ),
  });
}

export function operatorSurfaceCanRender(surface: OperatorSurfaceV1): boolean {
  return (
    surface.lifecycle.status === 'Approved' ||
    surface.lifecycle.status === 'Rendered' ||
    surface.lifecycle.status === 'Used'
  );
}

function parseContext(record: Record<string, unknown>): OperatorSurfaceContextV1 {
  const kind = readEnum(record, 'kind', ['Run', 'Approval'] as const, OperatorSurfaceParseError);
  assertOnlyAllowedKeys(
    record,
    kind === 'Run' ? RUN_CONTEXT_KEYS : APPROVAL_CONTEXT_KEYS,
    'context',
  );
  const runId = RunId(readString(record, 'runId', OperatorSurfaceParseError));
  if (kind === 'Run') {
    if (record['approvalId'] !== undefined) {
      throw new OperatorSurfaceParseError('Run context must not include approvalId.');
    }
    return { kind, runId };
  }
  return {
    kind,
    runId,
    approvalId: ApprovalId(readString(record, 'approvalId', OperatorSurfaceParseError)),
  };
}

function parseAttribution(record: Record<string, unknown>): OperatorSurfaceAttributionV1 {
  assertOnlyAllowedKeys(record, ATTRIBUTION_KEYS, 'attribution');
  return {
    proposedBy: parseActor(readRecordField(record, 'proposedBy', OperatorSurfaceParseError)),
    proposedAtIso: readIsoString(record, 'proposedAtIso', OperatorSurfaceParseError),
    rationale: readString(record, 'rationale', OperatorSurfaceParseError),
  };
}

function parseActor(record: Record<string, unknown>): OperatorSurfaceActorV1 {
  const kind = readEnum(
    record,
    'kind',
    ['Machine', 'User', 'System'] as const,
    OperatorSurfaceParseError,
  );
  if (kind === 'Machine') {
    assertOnlyAllowedKeys(record, MACHINE_ACTOR_KEYS, 'actor');
    return {
      kind,
      machineId: MachineId(readString(record, 'machineId', OperatorSurfaceParseError)),
    };
  }
  if (kind === 'User') {
    assertOnlyAllowedKeys(record, USER_ACTOR_KEYS, 'actor');
    return { kind, userId: UserId(readString(record, 'userId', OperatorSurfaceParseError)) };
  }
  assertOnlyAllowedKeys(record, SYSTEM_ACTOR_KEYS, 'actor');
  return { kind };
}

function parseLifecycle(record: Record<string, unknown>): OperatorSurfaceLifecycleV1 {
  assertOnlyAllowedKeys(record, LIFECYCLE_KEYS, 'lifecycle');
  const status = readEnum(record, 'status', LIFECYCLE_STATUSES, OperatorSurfaceParseError);
  const proposedAtIso = readIsoString(record, 'proposedAtIso', OperatorSurfaceParseError);
  const approvedAtIso = readOptionalIsoString(record, 'approvedAtIso', OperatorSurfaceParseError);
  const renderedAtIso = readOptionalIsoString(record, 'renderedAtIso', OperatorSurfaceParseError);
  const usedAtIso = readOptionalIsoString(record, 'usedAtIso', OperatorSurfaceParseError);
  validateLifecycle(status, {
    proposedAtIso,
    ...(approvedAtIso !== undefined ? { approvedAtIso } : {}),
    ...(renderedAtIso !== undefined ? { renderedAtIso } : {}),
    ...(usedAtIso !== undefined ? { usedAtIso } : {}),
  });

  const approvedByUserId = parseOptionalUserId(record, 'approvedByUserId');
  const renderedByUserId = parseOptionalUserId(record, 'renderedByUserId');
  const usedByUserId = parseOptionalUserId(record, 'usedByUserId');
  const evidenceIdsRaw = readOptionalStringArray(record, 'evidenceIds', OperatorSurfaceParseError);

  return {
    status,
    proposedAtIso,
    ...(approvedAtIso !== undefined ? { approvedAtIso } : {}),
    ...(approvedByUserId !== undefined ? { approvedByUserId } : {}),
    ...(renderedAtIso !== undefined ? { renderedAtIso } : {}),
    ...(renderedByUserId !== undefined ? { renderedByUserId } : {}),
    ...(usedAtIso !== undefined ? { usedAtIso } : {}),
    ...(usedByUserId !== undefined ? { usedByUserId } : {}),
    ...(evidenceIdsRaw !== undefined ? { evidenceIds: evidenceIdsRaw.map(EvidenceId) } : {}),
  };
}

function validateLifecycle(
  status: OperatorSurfaceLifecycleStatus,
  times: Readonly<{
    proposedAtIso: string;
    approvedAtIso?: string;
    renderedAtIso?: string;
    usedAtIso?: string;
  }>,
): void {
  if (status === 'Proposed' && (times.approvedAtIso || times.renderedAtIso || times.usedAtIso)) {
    throw new OperatorSurfaceParseError(
      'Proposed surfaces must not include later lifecycle times.',
    );
  }
  if (status !== 'Proposed' && times.approvedAtIso === undefined) {
    throw new OperatorSurfaceParseError('Approved lifecycle time is required.');
  }
  if ((status === 'Rendered' || status === 'Used') && times.renderedAtIso === undefined) {
    throw new OperatorSurfaceParseError('Rendered lifecycle time is required.');
  }
  if (status === 'Used' && times.usedAtIso === undefined) {
    throw new OperatorSurfaceParseError('Used lifecycle time is required.');
  }
  if (times.approvedAtIso) {
    assertNotBefore(times.proposedAtIso, times.approvedAtIso, OperatorSurfaceParseError, {
      anchorLabel: 'proposedAtIso',
      laterLabel: 'approvedAtIso',
    });
  }
  if (times.approvedAtIso && times.renderedAtIso) {
    assertNotBefore(times.approvedAtIso, times.renderedAtIso, OperatorSurfaceParseError, {
      anchorLabel: 'approvedAtIso',
      laterLabel: 'renderedAtIso',
    });
  }
  if (times.renderedAtIso && times.usedAtIso) {
    assertNotBefore(times.renderedAtIso, times.usedAtIso, OperatorSurfaceParseError, {
      anchorLabel: 'renderedAtIso',
      laterLabel: 'usedAtIso',
    });
  }
}

function parseBlock(value: unknown, path: string): OperatorSurfaceBlockV1 {
  const record = readRecord(value, path, OperatorSurfaceParseError);
  const blockType = readEnum(record, 'blockType', BLOCK_TYPES, OperatorSurfaceParseError);
  if (blockType === 'text') {
    assertOnlyAllowedKeys(record, TEXT_BLOCK_KEYS, path);
    const tone = readOptionalTone(record);
    return {
      blockType,
      text: readString(record, 'text', OperatorSurfaceParseError),
      ...(tone !== undefined ? { tone } : {}),
    };
  }
  if (blockType === 'keyValueList') return parseKeyValueListBlock(record);
  if (blockType === 'metric') return parseMetricBlock(record);
  if (blockType === 'form') return parseFormBlock(record);
  return parseActionsBlock(record);
}

function parseKeyValueListBlock(
  record: Record<string, unknown>,
): OperatorSurfaceKeyValueListBlockV1 {
  assertOnlyAllowedKeys(record, KEY_VALUE_LIST_BLOCK_KEYS, 'keyValueListBlock');
  const itemsRaw = record['items'];
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new OperatorSurfaceParseError('items must be a non-empty array.');
  }
  return {
    blockType: 'keyValueList',
    items: itemsRaw.map((item, index) => {
      const parsed = readRecord(item, `items[${String(index)}]`, OperatorSurfaceParseError);
      assertOnlyAllowedKeys(parsed, KEY_VALUE_ITEM_KEYS, `items[${String(index)}]`);
      return {
        label: readString(parsed, 'label', OperatorSurfaceParseError),
        value: readString(parsed, 'value', OperatorSurfaceParseError),
      };
    }),
  };
}

function parseMetricBlock(record: Record<string, unknown>): OperatorSurfaceMetricBlockV1 {
  assertOnlyAllowedKeys(record, METRIC_BLOCK_KEYS, 'metricBlock');
  const tone = readOptionalTone(record);
  const unit = readOptionalString(record, 'unit', OperatorSurfaceParseError);
  return {
    blockType: 'metric',
    label: readString(record, 'label', OperatorSurfaceParseError),
    value: readString(record, 'value', OperatorSurfaceParseError),
    ...(unit !== undefined ? { unit } : {}),
    ...(tone !== undefined ? { tone } : {}),
  };
}

function parseFormBlock(record: Record<string, unknown>): OperatorSurfaceFormBlockV1 {
  assertOnlyAllowedKeys(record, FORM_BLOCK_KEYS, 'formBlock');
  const fieldsRaw = record['fields'];
  if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0) {
    throw new OperatorSurfaceParseError('fields must be a non-empty array.');
  }
  return {
    blockType: 'form',
    fields: fieldsRaw.map((field, index) => parseField(field, `fields[${String(index)}]`)),
  };
}

function parseField(value: unknown, path: string): OperatorSurfaceFieldV1 {
  const record = readRecord(value, path, OperatorSurfaceParseError);
  assertOnlyAllowedKeys(record, FIELD_KEYS, path);
  const widget = readEnum(record, 'widget', FIELD_WIDGETS, OperatorSurfaceParseError);
  const optionsRaw = record['options'];
  const options = optionsRaw === undefined ? undefined : parseSelectOptions(optionsRaw);
  if (widget === 'select' && (options === undefined || options.length === 0)) {
    throw new OperatorSurfaceParseError('select fields require at least one option.');
  }
  if (widget !== 'select' && options !== undefined) {
    throw new OperatorSurfaceParseError('options are only valid for select fields.');
  }
  const required = readOptionalBoolean(record, 'required', OperatorSurfaceParseError);
  const helpText = readOptionalString(record, 'helpText', OperatorSurfaceParseError);
  const placeholder = readOptionalString(record, 'placeholder', OperatorSurfaceParseError);
  return {
    fieldId: readString(record, 'fieldId', OperatorSurfaceParseError),
    label: readString(record, 'label', OperatorSurfaceParseError),
    widget,
    ...(required !== undefined ? { required } : {}),
    ...(helpText !== undefined ? { helpText } : {}),
    ...(placeholder !== undefined ? { placeholder } : {}),
    ...(options !== undefined ? { options } : {}),
  };
}

function parseSelectOptions(value: unknown): readonly OperatorSurfaceSelectOptionV1[] {
  if (!Array.isArray(value)) {
    throw new OperatorSurfaceParseError('options must be an array.');
  }
  return value.map((option, index) => {
    const record = readRecord(option, `options[${String(index)}]`, OperatorSurfaceParseError);
    assertOnlyAllowedKeys(record, SELECT_OPTION_KEYS, `options[${String(index)}]`);
    return {
      value: readString(record, 'value', OperatorSurfaceParseError),
      label: readString(record, 'label', OperatorSurfaceParseError),
    };
  });
}

function parseActionsBlock(record: Record<string, unknown>): OperatorSurfaceActionsBlockV1 {
  assertOnlyAllowedKeys(record, ACTIONS_BLOCK_KEYS, 'actionsBlock');
  const actionsRaw = record['actions'];
  if (!Array.isArray(actionsRaw) || actionsRaw.length === 0) {
    throw new OperatorSurfaceParseError('actions must be a non-empty array.');
  }
  return {
    blockType: 'actions',
    actions: actionsRaw.map((action, index) => {
      const parsed = readRecord(action, `actions[${String(index)}]`, OperatorSurfaceParseError);
      assertOnlyAllowedKeys(parsed, ACTION_KEYS, `actions[${String(index)}]`);
      const submitsForm = readOptionalBoolean(parsed, 'submitsForm', OperatorSurfaceParseError);
      return {
        actionId: readString(parsed, 'actionId', OperatorSurfaceParseError),
        label: readString(parsed, 'label', OperatorSurfaceParseError),
        intentKind: readEnum(parsed, 'intentKind', INTENT_KINDS, OperatorSurfaceParseError),
        ...(submitsForm !== undefined ? { submitsForm } : {}),
      };
    }),
  };
}

function parseInteractionValues(
  surface: OperatorSurfaceV1,
  action: OperatorSurfaceActionV1,
  record: Record<string, unknown>,
): Readonly<Record<string, string | number | boolean>> {
  const fields = getSurfaceFields(surface);
  if (action.submitsForm !== true && Object.keys(record).length > 0) {
    throw new OperatorSurfaceParseError(
      'Actions that do not submit a form must not include values.',
    );
  }
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.trim() === '') {
      throw new OperatorSurfaceParseError('values keys must be non-empty.');
    }
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      throw new OperatorSurfaceParseError('values keys must be schema field IDs.');
    }
    const field = fields.get(key);
    if (field === undefined) {
      throw new OperatorSurfaceParseError('values may only include declared form fields.');
    }
    validateInteractionValue(field, value);
    values[key] = value;
  }
  if (action.submitsForm === true) {
    for (const field of fields.values()) {
      if (field.required === true && values[field.fieldId] === undefined) {
        throw new OperatorSurfaceParseError('required form fields must be submitted.');
      }
    }
  }
  return Object.freeze(values);
}

function validateInteractionValue(
  field: OperatorSurfaceFieldV1,
  value: unknown,
): asserts value is string | number | boolean {
  if (field.widget === 'checkbox') {
    if (typeof value !== 'boolean') {
      throw new OperatorSurfaceParseError('checkbox values must be booleans.');
    }
    return;
  }
  if (field.widget === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new OperatorSurfaceParseError('number values must be finite numbers.');
    }
    return;
  }
  if (field.widget === 'select') {
    if (typeof value !== 'string' || !field.options?.some((option) => option.value === value)) {
      throw new OperatorSurfaceParseError('select values must match a declared option.');
    }
    return;
  }
  if (typeof value !== 'string') {
    throw new OperatorSurfaceParseError('text values must be strings.');
  }
}

function getSurfaceFields(surface: OperatorSurfaceV1): ReadonlyMap<string, OperatorSurfaceFieldV1> {
  const fields = new Map<string, OperatorSurfaceFieldV1>();
  for (const block of surface.blocks) {
    if (block.blockType !== 'form') continue;
    for (const field of block.fields) fields.set(field.fieldId, field);
  }
  return fields;
}

function findAction(
  surface: OperatorSurfaceV1,
  actionId: string,
): OperatorSurfaceActionV1 | undefined {
  for (const block of surface.blocks) {
    if (block.blockType === 'actions') {
      const action = block.actions.find((candidate) => candidate.actionId === actionId);
      if (action !== undefined) return action;
    }
  }
  return undefined;
}

function parseOptionalUserId(record: Record<string, unknown>, key: string): UserIdType | undefined {
  const value = readOptionalString(record, key, OperatorSurfaceParseError);
  return value === undefined ? undefined : UserId(value);
}

function readOptionalTone(record: Record<string, unknown>): OperatorSurfaceTextTone | undefined {
  return readOptionalString(record, 'tone', OperatorSurfaceParseError) === undefined
    ? undefined
    : readEnum(record, 'tone', TEXT_TONES, OperatorSurfaceParseError);
}

function assertNoExecutableFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoExecutableFields(item, `${path}[${String(index)}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    if (isExecutableKey(key)) {
      throw new OperatorSurfaceParseError(`${path}.${key} is not allowed on operator surfaces.`);
    }
    assertNoExecutableFields(nested, `${path}.${key}`);
  }
}

function isExecutableKey(key: string): boolean {
  const normalized = key.toLowerCase();
  const formActionKey = 'form' + 'action';
  return (
    EXECUTABLE_KEYS.has(key) ||
    normalized.startsWith('on') ||
    normalized === 'srcdoc' ||
    normalized === formActionKey
  );
}

function assertOnlyAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new OperatorSurfaceParseError(`${path}.${key} is not allowed by OperatorSurfaceV1.`);
    }
  }
}

function validateUniqueSurfaceIds(blocks: readonly OperatorSurfaceBlockV1[]): void {
  const fieldIds = new Set<string>();
  const actionIds = new Set<string>();
  for (const block of blocks) {
    if (block.blockType === 'form') {
      for (const field of block.fields) {
        if (fieldIds.has(field.fieldId)) {
          throw new OperatorSurfaceParseError('fieldId values must be unique.');
        }
        fieldIds.add(field.fieldId);
      }
    }
    if (block.blockType === 'actions') {
      for (const action of block.actions) {
        if (actionIds.has(action.actionId)) {
          throw new OperatorSurfaceParseError('actionId values must be unique.');
        }
        actionIds.add(action.actionId);
      }
    }
  }
}

function deepFreezeSurface(surface: {
  schemaVersion: 1;
  surfaceId: OperatorSurfaceIdType;
  workspaceId: WorkspaceIdType;
  correlationId: CorrelationIdType;
  surfaceKind: OperatorSurfaceKind;
  context: OperatorSurfaceContextV1;
  title: string;
  description?: string;
  attribution: OperatorSurfaceAttributionV1;
  lifecycle: OperatorSurfaceLifecycleV1;
  blocks: OperatorSurfaceBlockV1[];
}): OperatorSurfaceV1 {
  Object.freeze(surface.context);
  Object.freeze(surface.attribution.proposedBy);
  Object.freeze(surface.attribution);
  Object.freeze(surface.lifecycle.evidenceIds);
  Object.freeze(surface.lifecycle);
  for (const block of surface.blocks) deepFreezeBlock(block);
  Object.freeze(surface.blocks);
  Object.freeze(surface);
  return surface;
}

function deepFreezeBlock(block: OperatorSurfaceBlockV1): void {
  if (block.blockType === 'keyValueList') {
    for (const item of block.items) Object.freeze(item);
    Object.freeze(block.items);
  }
  if (block.blockType === 'form') {
    for (const field of block.fields) {
      if (field.options !== undefined) {
        for (const option of field.options) Object.freeze(option);
        Object.freeze(field.options);
      }
      Object.freeze(field);
    }
    Object.freeze(block.fields);
  }
  if (block.blockType === 'actions') {
    for (const action of block.actions) Object.freeze(action);
    Object.freeze(block.actions);
  }
  Object.freeze(block);
}

function deepFreezeInteraction(
  interaction: OperatorSurfaceInteractionV1,
): OperatorSurfaceInteractionV1 {
  Object.freeze(interaction.values);
  Object.freeze(interaction);
  return interaction;
}
