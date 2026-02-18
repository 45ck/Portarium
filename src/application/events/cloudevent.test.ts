import { describe, expect, it } from 'vitest';

import { CorrelationId, WorkspaceId } from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import { domainEventToCloudEventsType, domainEventToPortariumCloudEvent } from './cloudevent.js';

const BASE_EVENT: DomainEventV1 = {
  schemaVersion: 1,
  eventId: 'evt-abc',
  eventType: 'RunStarted',
  aggregateKind: 'Run',
  aggregateId: 'run-1',
  occurredAtIso: '2026-02-18T00:00:00.000Z',
  workspaceId: WorkspaceId('ws-1'),
  correlationId: CorrelationId('corr-1'),
};

describe('domainEventToCloudEventsType', () => {
  it('builds type as com.portarium.<aggregate-lowercase>.<eventType>', () => {
    expect(domainEventToCloudEventsType({ aggregateKind: 'Run', eventType: 'RunStarted' })).toBe(
      'com.portarium.run.RunStarted',
    );
  });

  it('lowercases aggregateKind correctly for all aggregates', () => {
    expect(
      domainEventToCloudEventsType({ aggregateKind: 'Workspace', eventType: 'WorkspaceCreated' }),
    ).toBe('com.portarium.workspace.WorkspaceCreated');
    expect(
      domainEventToCloudEventsType({ aggregateKind: 'Approval', eventType: 'ApprovalGranted' }),
    ).toBe('com.portarium.approval.ApprovalGranted');
    expect(
      domainEventToCloudEventsType({ aggregateKind: 'Approval', eventType: 'ApprovalDenied' }),
    ).toBe('com.portarium.approval.ApprovalDenied');
    expect(domainEventToCloudEventsType({ aggregateKind: 'Run', eventType: 'RunSucceeded' })).toBe(
      'com.portarium.run.RunSucceeded',
    );
    expect(domainEventToCloudEventsType({ aggregateKind: 'Run', eventType: 'RunFailed' })).toBe(
      'com.portarium.run.RunFailed',
    );
    expect(
      domainEventToCloudEventsType({ aggregateKind: 'Policy', eventType: 'SodViolationDetected' }),
    ).toBe('com.portarium.policy.SodViolationDetected');
  });
});

describe('domainEventToPortariumCloudEvent', () => {
  it('sets specversion 1.0', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.specversion).toBe('1.0');
  });

  it('maps id from eventId', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.id).toBe('evt-abc');
  });

  it('derives type from aggregateKind and eventType', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.type).toBe('com.portarium.run.RunStarted');
  });

  it('sets source from parameter', () => {
    const source = 'portarium.control-plane.workflow-runtime';
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, source);
    expect(ce.source).toBe(source);
  });

  it('derives subject as <aggregateKind-plural>/<aggregateId>', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.subject).toBe('runs/run-1');
  });

  it('sets tenantid from workspaceId', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.tenantid).toBe('ws-1');
  });

  it('sets correlationid from correlationId', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.correlationid).toBe('corr-1');
  });

  it('sets time from occurredAtIso', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.time).toBe('2026-02-18T00:00:00.000Z');
  });

  it('sets datacontenttype to application/json', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.datacontenttype).toBe('application/json');
  });

  it('omits data when payload is absent', () => {
    const ce = domainEventToPortariumCloudEvent(BASE_EVENT, 'portarium.control-plane.runs');
    expect(ce.data).toBeUndefined();
  });

  it('includes data when payload is present', () => {
    const withPayload: DomainEventV1 = { ...BASE_EVENT, payload: { runId: 'run-1' } };
    const ce = domainEventToPortariumCloudEvent(withPayload, 'portarium.control-plane.runs');
    expect(ce.data).toEqual({ runId: 'run-1' });
  });

  it('produces subject for Approval aggregate', () => {
    const approvalEvent: DomainEventV1 = {
      ...BASE_EVENT,
      eventType: 'ApprovalGranted',
      aggregateKind: 'Approval',
      aggregateId: 'appr-99',
    };
    const ce = domainEventToPortariumCloudEvent(approvalEvent, 'portarium.control-plane.approvals');
    expect(ce.subject).toBe('approvals/appr-99');
    expect(ce.type).toBe('com.portarium.approval.ApprovalGranted');
  });

  it('produces subject for Workspace aggregate', () => {
    const wsEvent: DomainEventV1 = {
      ...BASE_EVENT,
      eventType: 'WorkspaceCreated',
      aggregateKind: 'Workspace',
      aggregateId: 'ws-1',
    };
    const ce = domainEventToPortariumCloudEvent(wsEvent, 'portarium.control-plane.application');
    expect(ce.subject).toBe('workspaces/ws-1');
    expect(ce.type).toBe('com.portarium.workspace.WorkspaceCreated');
  });
});
