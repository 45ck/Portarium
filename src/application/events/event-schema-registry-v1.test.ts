import { describe, expect, it, vi } from 'vitest';

import { CloudEventSchemaRegistry, type RegistryWarning } from './event-schema-registry-v1.js';
import type { CloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

function makeEvent(type: string, data?: unknown): CloudEventV1 {
  return {
    specversion: '1.0',
    id: 'evt-1',
    source: 'test',
    type,
    datacontenttype: 'application/json',
    ...(data !== undefined ? { data } : {}),
  };
}

describe('CloudEventSchemaRegistry', () => {
  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  it('rejects duplicate registration for the same version', () => {
    const registry = new CloudEventSchemaRegistry();
    registry.register('run', 'RunStarted', 1, () => undefined);
    expect(() => registry.register('run', 'RunStarted', 1, () => undefined)).toThrow(
      'duplicate registration',
    );
  });

  it('rejects version 0', () => {
    const registry = new CloudEventSchemaRegistry();
    expect(() => registry.register('run', 'RunStarted', 0, () => undefined)).toThrow();
  });

  it('rejects negative version', () => {
    const registry = new CloudEventSchemaRegistry();
    expect(() => registry.register('run', 'RunStarted', -1, () => undefined)).toThrow();
  });

  it('allows multiple versions for the same event type', () => {
    const registry = new CloudEventSchemaRegistry();
    expect(() => {
      registry.register('run', 'RunStarted', 1, () => undefined);
      registry.register('run', 'RunStarted', 2, () => undefined);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Dispatch — exact version match
  // -------------------------------------------------------------------------

  it('dispatches to the exact version handler', async () => {
    const registry = new CloudEventSchemaRegistry();
    const handler = vi.fn();
    registry.register('run', 'RunStarted', 1, handler);

    const event = makeEvent('com.portarium.run.RunStarted.v1', { runId: 'r-1' });
    const result = await registry.dispatch(event);

    expect(result).toEqual({ handled: true, version: 1 });
    expect(handler).toHaveBeenCalledWith(event, { runId: 'r-1' });
  });

  it('dispatches to the correct version when multiple are registered', async () => {
    const registry = new CloudEventSchemaRegistry();
    const v1Handler = vi.fn();
    const v2Handler = vi.fn();
    registry.register('run', 'RunStarted', 1, v1Handler);
    registry.register('run', 'RunStarted', 2, v2Handler);

    await registry.dispatch(makeEvent('com.portarium.run.RunStarted.v2'));

    expect(v1Handler).not.toHaveBeenCalled();
    expect(v2Handler).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Consumer resilience — unknown future version
  // -------------------------------------------------------------------------

  it('falls back to highest registered version when received version is unknown future', async () => {
    const warnings: RegistryWarning[] = [];
    const registry = new CloudEventSchemaRegistry({ onWarning: (w) => warnings.push(w) });
    const v2Handler = vi.fn();
    registry.register('run', 'RunStarted', 1, vi.fn());
    registry.register('run', 'RunStarted', 2, v2Handler);

    // Consumer knows up to v2 but event is v5
    const result = await registry.dispatch(makeEvent('com.portarium.run.RunStarted.v5'));

    expect(result).toEqual({ handled: true, version: 2 });
    expect(v2Handler).toHaveBeenCalled();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.kind).toBe('UnknownFutureVersion');
    expect(warnings[0]!.receivedVersion).toBe(5);
    expect(warnings[0]!.usedVersion).toBe(2);
  });

  it('falls back to lowest registered version when received version is lower than any registered', async () => {
    const warnings: RegistryWarning[] = [];
    const registry = new CloudEventSchemaRegistry({ onWarning: (w) => warnings.push(w) });
    const v3Handler = vi.fn();
    registry.register('run', 'RunStarted', 3, v3Handler);

    // Consumer only knows v3 but event is v1
    const result = await registry.dispatch(makeEvent('com.portarium.run.RunStarted.v1'));

    expect(result).toEqual({ handled: true, version: 3 });
    expect(v3Handler).toHaveBeenCalled();
    expect(warnings[0]!.kind).toBe('FallbackToLowerVersion');
  });

  it('emits no warning on exact version match', async () => {
    const warnings: RegistryWarning[] = [];
    const registry = new CloudEventSchemaRegistry({ onWarning: (w) => warnings.push(w) });
    registry.register('run', 'RunStarted', 1, vi.fn());

    await registry.dispatch(makeEvent('com.portarium.run.RunStarted.v1'));

    expect(warnings).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Forward compatibility — unknown event types
  // -------------------------------------------------------------------------

  it('returns UnknownType for completely unrecognised type strings', async () => {
    const registry = new CloudEventSchemaRegistry();
    const result = await registry.dispatch(makeEvent('io.cloudevents.other.v1'));
    expect(result).toEqual({ handled: false, reason: 'UnknownType' });
  });

  it('returns UnversionedType for legacy unversioned portarium type', async () => {
    const registry = new CloudEventSchemaRegistry();
    registry.register('run', 'RunStarted', 1, vi.fn());
    const result = await registry.dispatch(makeEvent('com.portarium.run.RunStarted'));
    expect(result).toEqual({ handled: false, reason: 'UnversionedType' });
  });

  it('returns NoHandlerRegistered for a versioned type with no handler', async () => {
    const registry = new CloudEventSchemaRegistry();
    // nothing registered for 'approval'
    const result = await registry.dispatch(makeEvent('com.portarium.approval.ApprovalGranted.v1'));
    expect(result).toEqual({ handled: false, reason: 'NoHandlerRegistered' });
  });

  it('does NOT throw for unknown types (forward compatibility)', async () => {
    const registry = new CloudEventSchemaRegistry();
    await expect(
      registry.dispatch(makeEvent('com.portarium.future.UnknownEvent.v99')),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // listRegistrations
  // -------------------------------------------------------------------------

  it('lists all registered handlers', () => {
    const registry = new CloudEventSchemaRegistry();
    registry.register('run', 'RunStarted', 1, vi.fn());
    registry.register('run', 'RunStarted', 2, vi.fn());
    registry.register('approval', 'ApprovalGranted', 1, vi.fn());

    const regs = registry.listRegistrations();
    expect(regs).toHaveLength(3);
    expect(
      regs.some((r) => r.aggregate === 'run' && r.eventName === 'RunStarted' && r.version === 1),
    ).toBe(true);
    expect(
      regs.some((r) => r.aggregate === 'run' && r.eventName === 'RunStarted' && r.version === 2),
    ).toBe(true);
    expect(
      regs.some(
        (r) => r.aggregate === 'approval' && r.eventName === 'ApprovalGranted' && r.version === 1,
      ),
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Async handlers
  // -------------------------------------------------------------------------

  it('awaits async handler before returning result', async () => {
    const registry = new CloudEventSchemaRegistry();
    const log: string[] = [];
    registry.register('run', 'RunStarted', 1, async () => {
      await Promise.resolve();
      log.push('handled');
    });

    await registry.dispatch(makeEvent('com.portarium.run.RunStarted.v1'));
    expect(log).toEqual(['handled']);
  });
});
