import { describe, expect, it } from 'vitest';

import { assertMonotonicLocationEvents, parseLocationEventV1 } from './location-event-v1.js';

function baseEvent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    locationEventId: 'loc-evt-1',
    tenantId: 'ws-1',
    assetId: 'asset-1',
    robotId: 'robot-1',
    sourceStreamId: 'stream-1',
    sourceType: 'SLAM',
    coordinateFrame: 'map',
    observedAtIso: '2026-02-19T10:00:00.000Z',
    ingestedAtIso: '2026-02-19T10:00:00.100Z',
    pose: {
      x: 12.1,
      y: 4.2,
      z: 0,
      yawRadians: 1.57,
    },
    velocity: {
      linearMetersPerSec: 0.8,
      angularRadiansPerSec: 0.1,
    },
    quality: {
      status: 'Known',
      horizontalStdDevMeters: 0.25,
      verticalStdDevMeters: 0.4,
    },
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('parseLocationEventV1', () => {
  it('parses a valid location event with known quality', () => {
    const parsed = parseLocationEventV1(baseEvent());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.sourceType).toBe('SLAM');
    expect(parsed.quality.status).toBe('Known');
  });

  it('supports explicit unknown quality payloads', () => {
    const parsed = parseLocationEventV1(
      baseEvent({
        quality: {
          status: 'Unknown',
          reason: 'provider did not send covariance',
        },
      }),
    );

    expect(parsed.quality.status).toBe('Unknown');
    if (parsed.quality.status === 'Unknown') {
      expect(parsed.quality.reason).toMatch(/provider/i);
    }
  });

  it('rejects ingestedAtIso earlier than observedAtIso', () => {
    expect(() =>
      parseLocationEventV1(
        baseEvent({
          observedAtIso: '2026-02-19T10:01:00.000Z',
          ingestedAtIso: '2026-02-19T10:00:59.000Z',
        }),
      ),
    ).toThrow(/ingestedAtIso/i);
  });

  it('rejects non-monotonic observedAtIso against previousObservedAtIso', () => {
    expect(() =>
      parseLocationEventV1(baseEvent(), {
        previousObservedAtIso: '2026-02-19T10:00:01.000Z',
      }),
    ).toThrow(/previousObservedAtIso/i);
  });

  it('rejects negative known-quality deviation values', () => {
    expect(() =>
      parseLocationEventV1(
        baseEvent({
          quality: {
            status: 'Known',
            horizontalStdDevMeters: -1,
          },
        }),
      ),
    ).toThrow(/non-negative/i);
  });
});

describe('assertMonotonicLocationEvents', () => {
  it('allows monotonic event sequences per source stream', () => {
    const events = [
      parseLocationEventV1(
        baseEvent({ locationEventId: 'evt-1', observedAtIso: '2026-02-19T10:00:00.000Z' }),
      ),
      parseLocationEventV1(
        baseEvent({
          locationEventId: 'evt-2',
          observedAtIso: '2026-02-19T10:00:01.000Z',
          ingestedAtIso: '2026-02-19T10:00:01.100Z',
        }),
      ),
      parseLocationEventV1(
        baseEvent({
          locationEventId: 'evt-3',
          sourceStreamId: 'stream-2',
          observedAtIso: '2026-02-19T09:59:59.000Z',
          ingestedAtIso: '2026-02-19T09:59:59.100Z',
        }),
      ),
    ];
    expect(() => assertMonotonicLocationEvents(events)).not.toThrow();
  });

  it('rejects non-monotonic order inside the same source stream', () => {
    const events = [
      parseLocationEventV1(
        baseEvent({
          locationEventId: 'evt-1',
          observedAtIso: '2026-02-19T10:00:02.000Z',
          ingestedAtIso: '2026-02-19T10:00:02.100Z',
        }),
      ),
      parseLocationEventV1(
        baseEvent({
          locationEventId: 'evt-2',
          observedAtIso: '2026-02-19T10:00:01.000Z',
          ingestedAtIso: '2026-02-19T10:00:01.100Z',
        }),
      ),
    ];
    expect(() => assertMonotonicLocationEvents(events)).toThrow(/previous observedAtIso/i);
  });
});
