import { describe, expect, it } from 'vitest';

import {
  InMemoryLocationDeadLetterStore,
  InMemoryLocationHistoryStore,
  InMemoryLocationLatestStateCache,
  LocalisationIngestionPipeline,
  type LocalisationInput,
} from './localisation-ingestion-pipeline.js';

class IncrementingIdGenerator {
  #next = 1;

  public generateId(): string {
    const value = `id-${this.#next}`;
    this.#next += 1;
    return value;
  }
}

class FixedClock {
  public nowIso(): string {
    return '2026-02-20T12:00:00.000Z';
  }
}

function createPipeline() {
  const latestStateCache = new InMemoryLocationLatestStateCache();
  const historyStore = new InMemoryLocationHistoryStore();
  const deadLetterStore = new InMemoryLocationDeadLetterStore();
  const pipeline = new LocalisationIngestionPipeline({
    idGenerator: new IncrementingIdGenerator(),
    clock: new FixedClock(),
    latestStateCache,
    historyStore,
    deadLetterStore,
    defaultFramesBySourceType: {
      GPS: 'wgs84',
      SLAM: 'map',
      odometry: 'odom',
      RTLS: 'site',
    },
  });
  return { pipeline, latestStateCache, historyStore, deadLetterStore };
}

function baseInput(overrides?: Partial<LocalisationInput>): LocalisationInput {
  return {
    tenantId: 'workspace-1',
    assetId: 'asset-1',
    robotId: 'robot-1',
    sourceStreamId: 'stream-1',
    sourceType: 'GPS',
    observedAtIso: '2026-02-20T11:00:00.000Z',
    correlationId: 'corr-1',
    latitude: 37.7749,
    longitude: -122.4194,
    horizontalAccuracyMeters: 0.8,
    ...overrides,
  } as LocalisationInput;
}

describe('LocalisationIngestionPipeline', () => {
  it('normalizes GPS, RTLS, and SLAM inputs into LocationEvent records and updates stores', async () => {
    const { pipeline, latestStateCache, historyStore, deadLetterStore } = createPipeline();

    const gpsResult = await pipeline.ingest(
      baseInput({
        sourceType: 'GPS',
        sourceStreamId: 'stream-gps-1',
        observedAtIso: '2026-02-20T11:00:00.000Z',
      }),
    );
    const rtlsResult = await pipeline.ingest({
      tenantId: 'workspace-1',
      assetId: 'asset-1',
      robotId: 'robot-1',
      sourceStreamId: 'stream-rtls-1',
      sourceType: 'RTLS',
      observedAtIso: '2026-02-20T11:00:01.000Z',
      coordinateFrame: 'floor-1',
      correlationId: 'corr-2',
      xMeters: 12.5,
      yMeters: 9.25,
      zMeters: 0.1,
      headingDegrees: 90,
      horizontalAccuracyMeters: 0.25,
    });
    const slamResult = await pipeline.ingest({
      tenantId: 'workspace-1',
      assetId: 'asset-1',
      robotId: 'robot-1',
      sourceStreamId: 'stream-slam-1',
      sourceType: 'SLAM',
      observedAtIso: '2026-02-20T11:00:02.000Z',
      correlationId: 'corr-3',
      pose: {
        x: 14.1,
        y: 5.2,
        z: 0,
        yawRadians: 1.57,
      },
      velocity: {
        linearMetersPerSec: 0.9,
        angularRadiansPerSec: 0.2,
      },
      qualityKnown: {
        horizontalStdDevMeters: 0.3,
      },
    });

    expect(gpsResult.ok).toBe(true);
    expect(rtlsResult.ok).toBe(true);
    expect(slamResult.ok).toBe(true);
    if (!gpsResult.ok || !rtlsResult.ok || !slamResult.ok) {
      return;
    }

    expect(gpsResult.event.sourceType).toBe('GPS');
    expect(gpsResult.event.coordinateFrame).toBe('wgs84');
    expect(gpsResult.event.quality.status).toBe('Known');
    expect(gpsResult.cloudEvent.type).toBe('com.portarium.location.LocationEventIngested');
    expect(gpsResult.cloudEvent.datacontenttype).toBe('application/json');

    expect(rtlsResult.event.sourceType).toBe('RTLS');
    expect(rtlsResult.event.coordinateFrame).toBe('floor-1');
    expect(rtlsResult.event.pose.yawRadians).toBeCloseTo(Math.PI / 2);

    expect(slamResult.event.sourceType).toBe('SLAM');
    expect(slamResult.event.coordinateFrame).toBe('map');
    expect(slamResult.event.quality.status).toBe('Known');

    const latest = await latestStateCache.get('workspace-1', 'asset-1');
    expect(latest).not.toBeNull();
    expect(latest?.locationEventId).toBe(slamResult.event.locationEventId);

    const history = await historyStore.listByAsset('workspace-1', 'asset-1');
    expect(history).toHaveLength(3);

    const deadLetters = await deadLetterStore.list('workspace-1');
    expect(deadLetters).toHaveLength(0);
  });

  it('writes dead-letter entries when coordinate frame cannot be resolved', async () => {
    const latestStateCache = new InMemoryLocationLatestStateCache();
    const historyStore = new InMemoryLocationHistoryStore();
    const deadLetterStore = new InMemoryLocationDeadLetterStore();
    const pipeline = new LocalisationIngestionPipeline({
      idGenerator: new IncrementingIdGenerator(),
      clock: new FixedClock(),
      latestStateCache,
      historyStore,
      deadLetterStore,
      defaultFramesBySourceType: {},
    });

    const result = await pipeline.ingest(
      baseInput({
        sourceType: 'GPS',
        sourceStreamId: 'stream-gps-missing-frame',
        observedAtIso: '2026-02-20T11:10:00.000Z',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.deadLetter.reason).toMatch(/Missing coordinate frame/i);
    const deadLetters = await deadLetterStore.list('workspace-1');
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]?.payload).toMatchObject({
      sourceType: 'GPS',
      sourceStreamId: 'stream-gps-missing-frame',
    });

    const history = await historyStore.listByAsset('workspace-1', 'asset-1');
    expect(history).toHaveLength(0);
    const latest = await latestStateCache.get('workspace-1', 'asset-1');
    expect(latest).toBeNull();
  });

  it('routes non-monotonic source-stream observations to dead letter and preserves previous history', async () => {
    const { pipeline, historyStore, deadLetterStore } = createPipeline();

    const first = await pipeline.ingest(
      baseInput({
        sourceType: 'GPS',
        sourceStreamId: 'stream-gps-monotonic',
        observedAtIso: '2026-02-20T11:20:00.000Z',
      }),
    );
    const second = await pipeline.ingest(
      baseInput({
        sourceType: 'GPS',
        sourceStreamId: 'stream-gps-monotonic',
        observedAtIso: '2026-02-20T11:19:59.000Z',
      }),
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    const history = await historyStore.listByAsset('workspace-1', 'asset-1');
    expect(history).toHaveLength(1);
    const deadLetters = await deadLetterStore.list('workspace-1');
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]?.reason).toMatch(/previousObservedAtIso/i);
  });
});
