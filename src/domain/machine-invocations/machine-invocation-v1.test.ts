import { describe, expect, it } from 'vitest';

import {
  MachineInvocationParseError,
  parseMachineInvocationProgressEventV1,
  parseMachineInvocationRequestV1,
  parseMachineInvocationResponseV1,
} from './machine-invocation-v1.js';

describe('MachineInvocation request parser', () => {
  it('parses valid invocation requests', () => {
    const request = parseMachineInvocationRequestV1({
      schemaVersion: 1,
      invocationId: 'invocation-1',
      machineId: 'machine-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      action: 'poster.generate',
      input: { prompt: 'hello', style: 'short' },
      callbackUrl: 'https://callback.local/invocations/invocation-1',
      idempotencyKey: 'idempotency-1',
    });

    expect(request.invocationId).toBe('invocation-1');
    expect(request.action).toBe('poster.generate');
    expect(request.input).toEqual({ prompt: 'hello', style: 'short' });
  });

  it('rejects non-object requests and unsupported versions', () => {
    expect(() => parseMachineInvocationRequestV1('bad')).toThrow(MachineInvocationParseError);
    expect(() =>
      parseMachineInvocationRequestV1({
        schemaVersion: 2,
        invocationId: 'invocation-1',
        machineId: 'machine-1',
        workspaceId: 'ws-1',
        action: 'x',
      }),
    ).toThrow(/Unsupported schemaVersion/i);
  });

  it('validates optional request URL and input payload shape', () => {
    expect(() =>
      parseMachineInvocationRequestV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        machineId: 'machine-1',
        workspaceId: 'ws-1',
        action: 'x',
        callbackUrl: 'ftp://bad.example',
      }),
    ).toThrow(/http\(s\) URL/i);

    expect(() =>
      parseMachineInvocationRequestV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        machineId: 'machine-1',
        workspaceId: 'ws-1',
        action: 'x',
        input: 'not-object',
      }),
    ).toThrow(/input must be an object/i);
  });
});

describe('MachineInvocation response parser', () => {
  it('parses valid responses with artifact references', () => {
    const response = parseMachineInvocationResponseV1({
      schemaVersion: 1,
      invocationId: 'invocation-1',
      status: 'completed',
      statusUrl: 'https://machine.local/invocations/invocation-1',
      artifactUris: ['s3://bucket/artifacts/out1.json'],
    });

    expect(response.invocationId).toBe('invocation-1');
    expect(response.status).toBe('completed');
    expect(response.artifactUris).toEqual(['s3://bucket/artifacts/out1.json']);
  });

  it('accepts deprecated outputArtifactUris alias and rejects malformed artifact URI arrays', () => {
    expect(() =>
      parseMachineInvocationResponseV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        status: 'bogus',
      }),
    ).toThrow(/must be one of/i);

    expect(() =>
      parseMachineInvocationResponseV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        status: 'accepted',
        outputArtifactUris: [42],
      }),
    ).toThrow(/outputArtifactUris\[0\] must be a non-empty string/i);

    expect(
      parseMachineInvocationResponseV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        status: 'running',
        outputArtifactUris: ['s3://bucket/artifacts/out-legacy.json'],
      }).artifactUris,
    ).toEqual(['s3://bucket/artifacts/out-legacy.json']);
  });
});

describe('MachineInvocation progress event parser', () => {
  it('parses valid machine progress events', () => {
    const event = parseMachineInvocationProgressEventV1({
      schemaVersion: 1,
      invocationId: 'invocation-1',
      status: 'running',
      progressRatio: 0.62,
      step: 'embedding',
      diagnostics: 'step complete',
    });

    expect(event.invocationId).toBe('invocation-1');
    expect(event.progressRatio).toBe(0.62);
  });

  it('rejects malformed progress ratios and unsupported status', () => {
    expect(() =>
      parseMachineInvocationProgressEventV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        status: 'bogus',
        progressRatio: 0.5,
      }),
    ).toThrow(/must be one of/i);

    expect(() =>
      parseMachineInvocationProgressEventV1({
        schemaVersion: 1,
        invocationId: 'invocation-1',
        status: 'running',
        progressRatio: 2,
      }),
    ).toThrow(/between 0 and 1/i);
  });
});
