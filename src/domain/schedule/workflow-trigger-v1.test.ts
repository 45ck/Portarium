import { describe, expect, it } from 'vitest';

import { parseWorkflowTriggerV1 } from './workflow-trigger-v1.js';

const VALID_CRON_TRIGGER = {
  schemaVersion: 1,
  triggerDefinitionId: 'trig-1',
  workspaceId: 'ws-1',
  workflowId: 'wf-1',
  kind: 'Cron',
  config: { expression: '0 9 * * MON' },
  active: true,
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

const VALID_WEBHOOK_TRIGGER = {
  schemaVersion: 1,
  triggerDefinitionId: 'trig-2',
  workspaceId: 'ws-1',
  workflowId: 'wf-2',
  kind: 'Webhook',
  config: { endpointPath: '/hooks/incoming' },
  active: true,
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

const VALID_DOMAIN_EVENT_TRIGGER = {
  schemaVersion: 1,
  triggerDefinitionId: 'trig-3',
  workspaceId: 'ws-1',
  workflowId: 'wf-3',
  kind: 'DomainEvent',
  config: { eventType: 'InvoiceCreated' },
  active: false,
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

const VALID_MANUAL_TRIGGER = {
  schemaVersion: 1,
  triggerDefinitionId: 'trig-4',
  workspaceId: 'ws-1',
  workflowId: 'wf-4',
  kind: 'Manual',
  config: { label: 'Run manually' },
  active: true,
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

describe('parseWorkflowTriggerV1: happy path', () => {
  it('parses a Cron trigger', () => {
    const trigger = parseWorkflowTriggerV1(VALID_CRON_TRIGGER);

    expect(trigger.schemaVersion).toBe(1);
    expect(trigger.triggerDefinitionId).toBe('trig-1');
    expect(trigger.kind).toBe('Cron');
    expect(trigger.config).toEqual({ expression: '0 9 * * MON' });
    expect(trigger.active).toBe(true);
  });

  it('parses a Webhook trigger', () => {
    const trigger = parseWorkflowTriggerV1(VALID_WEBHOOK_TRIGGER);

    expect(trigger.kind).toBe('Webhook');
    expect(trigger.config).toEqual({ endpointPath: '/hooks/incoming' });
  });

  it('parses a DomainEvent trigger', () => {
    const trigger = parseWorkflowTriggerV1(VALID_DOMAIN_EVENT_TRIGGER);

    expect(trigger.kind).toBe('DomainEvent');
    expect(trigger.config).toEqual({ eventType: 'InvoiceCreated' });
    expect(trigger.active).toBe(false);
  });

  it('parses a Manual trigger with label', () => {
    const trigger = parseWorkflowTriggerV1(VALID_MANUAL_TRIGGER);

    expect(trigger.kind).toBe('Manual');
    expect(trigger.config).toEqual({ label: 'Run manually' });
  });

  it('parses a Manual trigger without label', () => {
    const trigger = parseWorkflowTriggerV1({
      ...VALID_MANUAL_TRIGGER,
      config: {},
    });

    expect(trigger.kind).toBe('Manual');
    expect(trigger.config).toEqual({});
  });
});

describe('parseWorkflowTriggerV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseWorkflowTriggerV1('nope')).toThrow(/WorkflowTrigger must be an object/i);
    expect(() => parseWorkflowTriggerV1(null)).toThrow(/WorkflowTrigger must be an object/i);
    expect(() => parseWorkflowTriggerV1([])).toThrow(/WorkflowTrigger must be an object/i);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, schemaVersion: 2 })).toThrow(
      /schemaVersion/i,
    );
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, schemaVersion: 1.5 })).toThrow(
      /schemaVersion/i,
    );
  });

  it('rejects invalid kind', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, kind: 'Timer' })).toThrow(
      /kind must be one of/i,
    );
  });

  it('rejects non-boolean active', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, active: 'yes' })).toThrow(
      /active must be a boolean/i,
    );
  });

  it('rejects non-object config', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, config: 'bad' })).toThrow(
      /config must be an object/i,
    );
  });

  it('rejects Cron config without expression', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, config: {} })).toThrow(
      /config\.expression/i,
    );
  });

  it('rejects Webhook config without endpointPath', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_WEBHOOK_TRIGGER, config: {} })).toThrow(
      /config\.endpointPath/i,
    );
  });

  it('rejects DomainEvent config without eventType', () => {
    expect(() => parseWorkflowTriggerV1({ ...VALID_DOMAIN_EVENT_TRIGGER, config: {} })).toThrow(
      /config\.eventType/i,
    );
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, triggerDefinitionId: undefined }),
    ).toThrow(/triggerDefinitionId/i);
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, workspaceId: undefined })).toThrow(
      /workspaceId/i,
    );
    expect(() => parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, workflowId: undefined })).toThrow(
      /workflowId/i,
    );
  });

  it('rejects invalid createdAtIso', () => {
    expect(() =>
      parseWorkflowTriggerV1({ ...VALID_CRON_TRIGGER, createdAtIso: 'not-a-date' }),
    ).toThrow(/createdAtIso/i);
  });
});
