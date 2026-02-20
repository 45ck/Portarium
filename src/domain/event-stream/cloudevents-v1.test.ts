import { describe, expect, it } from 'vitest';

import {
  parseCloudEventV1,
  parsePortariumCloudEventV1,
  parsePortariumRobotCloudEventV1,
} from './cloudevents-v1.js';

describe('parseCloudEventV1: happy path', () => {
  it('parses a minimal CloudEventV1', () => {
    const evt = parseCloudEventV1({
      specversion: '1.0',
      id: 'evt-1',
      source: 'portarium://control-plane',
      type: 'portarium.run.started',
    });

    expect(evt.specversion).toBe('1.0');
    expect(evt.id).toBe('evt-1');
    expect(evt.source).toContain('portarium');
    expect(evt.type).toContain('portarium');
    expect(evt.subject).toBeUndefined();
  });

  it('parses optional attributes and data payload', () => {
    const evt = parseCloudEventV1({
      specversion: '1.0',
      id: 'evt-2',
      source: 'portarium://control-plane',
      type: 'portarium.evidence.recorded',
      subject: 'run/run-1',
      time: '2026-02-17T00:00:00.000Z',
      datacontenttype: 'application/json',
      dataschema: 'portarium://schemas/evidence/1.0',
      data: { ok: true },
    });

    expect(evt.subject).toBe('run/run-1');
    expect(evt.datacontenttype).toBe('application/json');
    expect(evt.dataschema).toContain('schemas');
    expect(evt.data).toEqual({ ok: true });
  });

  it('allows data_base64 but not together with data', () => {
    const evt = parseCloudEventV1({
      specversion: '1.0',
      id: 'evt-3',
      source: 'portarium://control-plane',
      type: 'portarium.artifact.produced',
      data_base64: 'ZGF0YQ==',
    });

    expect(evt.data_base64).toBe('ZGF0YQ==');
  });
});

describe('parseCloudEventV1: validation', () => {
  it('rejects invalid top-level values and required attributes', () => {
    expect(() => parseCloudEventV1('nope')).toThrow(/CloudEvent must be an object/i);

    expect(() =>
      parseCloudEventV1({
        specversion: '0.3',
        id: 'evt-1',
        source: 's',
        type: 't',
      }),
    ).toThrow(/specversion/i);

    expect(() =>
      parseCloudEventV1({
        specversion: '1.0',
        id: '   ',
        source: 's',
        type: 't',
      }),
    ).toThrow(/id/i);
  });

  it('rejects invalid optional attributes and data encoding', () => {
    expect(() =>
      parseCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        datacontenttype: '   ',
      }),
    ).toThrow(/datacontenttype/i);

    expect(() =>
      parseCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        data: { ok: true },
        data_base64: 'ZGF0YQ==',
      }),
    ).toThrow(/both data and data_base64/i);

    expect(() =>
      parseCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        data_base64: '   ',
      }),
    ).toThrow(/data_base64/i);
  });
});

describe('parsePortariumCloudEventV1: happy path', () => {
  it('parses stable Portarium extension attributes', () => {
    const evt = parsePortariumCloudEventV1({
      specversion: '1.0',
      id: 'evt-10',
      source: 'portarium://control-plane',
      type: 'portarium.run.started',
      tenantid: 'tenant-1',
      correlationid: 'corr-1',
      runid: 'run-1',
      actionid: 'action-1',
      datacontenttype: 'application/json',
      data: { runStatus: 'Running' },
    });

    expect(evt.tenantid).toBe('tenant-1');
    expect(evt.correlationid).toBe('corr-1');
    expect(evt.runid).toBe('run-1');
    expect(evt.actionid).toBe('action-1');
    expect(evt.data).toEqual({ runStatus: 'Running' });
  });

  it('ignores additive extension fields to preserve consumer forward-compatibility', () => {
    const evt = parsePortariumCloudEventV1({
      specversion: '1.0',
      id: 'evt-11',
      source: 'portarium://control-plane',
      type: 'portarium.run.updated',
      tenantid: 'tenant-1',
      correlationid: 'corr-1',
      runid: 'run-1',
      datacontenttype: 'application/json',
      data: { status: 'Running' },
      // Future producer extension that this consumer does not model yet.
      producer_extension_v2: { rollout: 'phase-1' },
    });

    expect(evt.tenantid).toBe('tenant-1');
    expect(evt.correlationid).toBe('corr-1');
    expect(evt.runid).toBe('run-1');
    expect(evt.data).toEqual({ status: 'Running' });
    expect((evt as Record<string, unknown>)['producer_extension_v2']).toBeUndefined();
  });
});

describe('parsePortariumCloudEventV1: validation', () => {
  it('rejects missing tenantid and correlationid', () => {
    expect(() =>
      parsePortariumCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        correlationid: 'corr-1',
      }),
    ).toThrow(/tenantid/i);

    expect(() =>
      parsePortariumCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        tenantid: 'tenant-1',
      }),
    ).toThrow(/correlationid/i);
  });

  it('rejects invalid optional IDs', () => {
    expect(() =>
      parsePortariumCloudEventV1({
        specversion: '1.0',
        id: 'evt-1',
        source: 's',
        type: 't',
        tenantid: 'tenant-1',
        correlationid: 'corr-1',
        runid: '   ',
      }),
    ).toThrow(/runid/i);
  });
});

describe('parsePortariumRobotCloudEventV1', () => {
  const base = {
    specversion: '1.0',
    id: 'evt-r1',
    source: 'portarium://robotics',
    type: 'com.portarium.robot.mission.Dispatched',
    tenantid: 'tenant-1',
    correlationid: 'corr-1',
    robotid: 'robot-1',
    fleetid: 'fleet-1',
    missionid: 'mis-1',
  } as const;

  it('parses required robotics correlation extension fields', () => {
    const evt = parsePortariumRobotCloudEventV1({
      ...base,
      data: { status: 'Dispatched' },
    });

    expect(evt.robotid).toBe('robot-1');
    expect(evt.fleetid).toBe('fleet-1');
    expect(evt.missionid).toBe('mis-1');
  });

  it('rejects missing robot correlation fields', () => {
    expect(() =>
      parsePortariumRobotCloudEventV1({
        ...base,
        missionid: undefined,
      }),
    ).toThrow(/missionid/i);
  });

  it('roundtrips through JSON serialisation', () => {
    const parsed = parsePortariumRobotCloudEventV1(base);
    const roundtrip = parsePortariumRobotCloudEventV1(JSON.parse(JSON.stringify(parsed)));
    expect(roundtrip).toEqual(parsed);
  });
});
