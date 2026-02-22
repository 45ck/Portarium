import { describe, expect, it } from 'vitest';

import {
  parseCloudEventType,
  buildCloudEventType,
  extractCloudEventTypeVersion,
  isVersionedCloudEventType,
  PORTARIUM_CE_NAMESPACE,
} from './cloudevent-type-version-v1.js';

describe('parseCloudEventType', () => {
  it('parses a versioned type string', () => {
    const result = parseCloudEventType('com.portarium.run.RunStarted.v1');
    expect(result).toEqual({
      raw: 'com.portarium.run.RunStarted.v1',
      namespace: PORTARIUM_CE_NAMESPACE,
      aggregate: 'run',
      eventName: 'RunStarted',
      version: 1,
    });
  });

  it('parses higher version numbers', () => {
    const result = parseCloudEventType('com.portarium.approval.ApprovalGranted.v12');
    expect(result?.version).toBe(12);
    expect(result?.eventName).toBe('ApprovalGranted');
    expect(result?.aggregate).toBe('approval');
  });

  it('parses a legacy unversioned type string', () => {
    const result = parseCloudEventType('com.portarium.run.RunStarted');
    expect(result).toBeDefined();
    expect(result?.version).toBeUndefined();
    expect(result?.eventName).toBe('RunStarted');
  });

  it('returns undefined for non-portarium type', () => {
    expect(parseCloudEventType('io.cloudevents.example')).toBeUndefined();
  });

  it('returns undefined for too-short portarium type', () => {
    expect(parseCloudEventType('com.portarium.run')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseCloudEventType('')).toBeUndefined();
  });
});

describe('buildCloudEventType', () => {
  it('builds a versioned type string', () => {
    expect(buildCloudEventType('run', 'RunStarted', 1)).toBe('com.portarium.run.RunStarted.v1');
  });

  it('lowercases the aggregate segment', () => {
    expect(buildCloudEventType('Approval', 'ApprovalGranted', 2)).toBe(
      'com.portarium.approval.ApprovalGranted.v2',
    );
  });

  it('throws for version 0', () => {
    expect(() => buildCloudEventType('run', 'RunStarted', 0)).toThrow();
  });

  it('throws for negative version', () => {
    expect(() => buildCloudEventType('run', 'RunStarted', -1)).toThrow();
  });

  it('throws for non-integer version', () => {
    expect(() => buildCloudEventType('run', 'RunStarted', 1.5)).toThrow();
  });

  it('throws for empty aggregate', () => {
    expect(() => buildCloudEventType('', 'RunStarted', 1)).toThrow();
  });

  it('throws for empty eventName', () => {
    expect(() => buildCloudEventType('run', '', 1)).toThrow();
  });

  it('roundtrips through parse', () => {
    const type = buildCloudEventType('workflow', 'WorkflowActivated', 3);
    const parsed = parseCloudEventType(type);
    expect(parsed?.version).toBe(3);
    expect(parsed?.eventName).toBe('WorkflowActivated');
    expect(parsed?.aggregate).toBe('workflow');
  });
});

describe('extractCloudEventTypeVersion', () => {
  it('returns version for versioned type', () => {
    expect(extractCloudEventTypeVersion('com.portarium.run.RunStarted.v5')).toBe(5);
  });

  it('returns undefined for unversioned type', () => {
    expect(extractCloudEventTypeVersion('com.portarium.run.RunStarted')).toBeUndefined();
  });

  it('returns undefined for non-portarium type', () => {
    expect(extractCloudEventTypeVersion('com.other.event.Type')).toBeUndefined();
  });
});

describe('isVersionedCloudEventType', () => {
  it('returns true for versioned type', () => {
    expect(isVersionedCloudEventType('com.portarium.run.RunStarted.v1')).toBe(true);
  });

  it('returns false for legacy unversioned type', () => {
    expect(isVersionedCloudEventType('com.portarium.run.RunStarted')).toBe(false);
  });

  it('returns false for non-portarium type', () => {
    expect(isVersionedCloudEventType('io.cloudevents.example.v1')).toBe(false);
  });
});
