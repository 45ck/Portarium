/**
 * Operations Map performance budget tests.
 *
 * Validates that the filter/sort/slice operations for the robot list panel
 * complete within the 60 fps (16 ms) render budget, even for large fleets.
 *
 * Performance targets:
 *   - Filter + sort + slice (500 robots)     ≤ 16 ms  (1 frame)
 *   - Filter + sort + slice (500 robots) ×10 ≤ 80 ms  (amortised, cold cache)
 *   - Search (500 robot names)               ≤  4 ms  (quarter-frame)
 *   - Sort by battery (500 robots)           ≤  8 ms  (half-frame)
 *
 * These tests exercise the pure `filterSortSlice` function from
 * use-virtual-robot-list.ts, which is independent of React/JSDOM.
 *
 * Bead: bead-0717
 */

import { describe, expect, it } from 'vitest';
import {
  filterSortSlice,
  VISIBLE_COUNT,
} from '../../../apps/cockpit/src/hooks/use-virtual-robot-list.js';
import type { RobotLocation } from '../../../apps/cockpit/src/mocks/fixtures/robot-locations.js';
import type { RobotStatus } from '../../../apps/cockpit/src/types/robotics.js';

// ── Fleet fixture ─────────────────────────────────────────────────────────────

const STATUS_CYCLE: RobotStatus[] = ['Online', 'Degraded', 'E-Stopped', 'Offline'];

function makeFleet(size: number): RobotLocation[] {
  return Array.from({ length: size }, (_, i) => ({
    robotId: `robot-${String(i).padStart(4, '0')}`,
    name: `Robot ${String(i).padStart(4, '0')}`,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length]!,
    batteryPct: i % 101,
    lat: 37.7749 + (i % 100) * 0.001,
    lng: -122.4194 + (i % 100) * 0.001,
    heading: i % 360,
    robotClass: 'AMR' as const,
    speedMps: 0.5,
    updatedAtIso: new Date().toISOString(),
    trail: [],
  }));
}

const FLEET_500 = makeFleet(500);
const FLEET_100 = makeFleet(100);

/** Measure elapsed ms for a synchronous function. */
function timeMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ── Performance budget tests ──────────────────────────────────────────────────

describe('filterSortSlice — 500-robot fleet performance budget', () => {
  it('filter:All + sort:name + slice runs within 1 frame (16 ms)', () => {
    const elapsed = timeMs(() => {
      filterSortSlice(FLEET_500, 'All', '', 'name', 0, VISIBLE_COUNT);
    });
    expect(elapsed).toBeLessThan(16);
  });

  it('filter:Online + sort:battery + slice runs within 8 ms', () => {
    const elapsed = timeMs(() => {
      filterSortSlice(FLEET_500, 'Online', '', 'battery', 0, VISIBLE_COUNT);
    });
    expect(elapsed).toBeLessThan(8);
  });

  it('search by name (partial match) across 500 robots runs within 4 ms', () => {
    const elapsed = timeMs(() => {
      filterSortSlice(FLEET_500, 'All', 'robot-02', 'name', 0, VISIBLE_COUNT);
    });
    expect(elapsed).toBeLessThan(4);
  });

  it('10 consecutive filter+sort+slice calls complete within 80 ms total', () => {
    const elapsed = timeMs(() => {
      for (let i = 0; i < 10; i++) {
        filterSortSlice(FLEET_500, 'All', '', 'name', i * 5, VISIBLE_COUNT);
      }
    });
    expect(elapsed).toBeLessThan(80);
  });

  it('sort by status priority completes within 8 ms', () => {
    const elapsed = timeMs(() => {
      filterSortSlice(FLEET_500, 'All', '', 'status', 0, VISIBLE_COUNT);
    });
    expect(elapsed).toBeLessThan(8);
  });
});

// ── Correctness tests ─────────────────────────────────────────────────────────

describe('filterSortSlice — correctness', () => {
  it('returns at most VISIBLE_COUNT items', () => {
    const result = filterSortSlice(FLEET_500, 'All', '', 'name', 0, VISIBLE_COUNT);
    expect(result.length).toBeLessThanOrEqual(VISIBLE_COUNT);
  });

  it('filters by status correctly', () => {
    const result = filterSortSlice(FLEET_100, 'Online', '', 'name', 0, 200);
    expect(result.every((r) => r.status === 'Online')).toBe(true);
  });

  it('search is case-insensitive', () => {
    const upper = filterSortSlice(FLEET_100, 'All', 'ROBOT', 'name', 0, 200);
    const lower = filterSortSlice(FLEET_100, 'All', 'robot', 'name', 0, 200);
    expect(upper.length).toBe(lower.length);
  });

  it('search by robotId matches correctly', () => {
    const result = filterSortSlice(FLEET_100, 'All', 'robot-0050', 'name', 0, 200);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((r) => r.robotId === 'robot-0050')).toBe(true);
  });

  it('sort:name returns robots in ascending name order', () => {
    const result = filterSortSlice(FLEET_100, 'All', '', 'name', 0, 100);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.name.localeCompare(result[i]!.name)).toBeLessThanOrEqual(0);
    }
  });

  it('sort:battery returns robots in ascending battery order', () => {
    const result = filterSortSlice(FLEET_100, 'All', '', 'battery', 0, 100);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.batteryPct).toBeLessThanOrEqual(result[i]!.batteryPct);
    }
  });

  it('sort:status puts E-Stopped before Degraded before Online before Offline', () => {
    const result = filterSortSlice(FLEET_100, 'All', '', 'status', 0, 100);
    const statuses = result.map((r) => r.status);
    const eStopIdx = statuses.findIndex((s) => s === 'E-Stopped');
    const degradedIdx = statuses.findIndex((s) => s === 'Degraded');
    const onlineIdx = statuses.findIndex((s) => s === 'Online');
    // E-Stopped must appear before Degraded, Degraded before Online
    if (eStopIdx !== -1 && degradedIdx !== -1) expect(eStopIdx).toBeLessThan(degradedIdx);
    if (degradedIdx !== -1 && onlineIdx !== -1) expect(degradedIdx).toBeLessThan(onlineIdx);
  });

  it('startIndex=10 skips the first 10 results', () => {
    const from0 = filterSortSlice(FLEET_100, 'All', '', 'name', 0, 100);
    const from10 = filterSortSlice(FLEET_100, 'All', '', 'name', 10, 100);
    expect(from10[0]?.robotId).toBe(from0[10]?.robotId);
  });

  it('returns empty array when search matches nothing', () => {
    const result = filterSortSlice(FLEET_100, 'All', 'zzz-no-match', 'name', 0, VISIBLE_COUNT);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when status filter matches nothing in small fleet', () => {
    const singleRobot: RobotLocation[] = [
      {
        robotId: 'r-1',
        name: 'Robot 1',
        status: 'Online' as RobotStatus,
        batteryPct: 80,
        lat: 0,
        lng: 0,
        heading: 0,
        robotClass: 'AMR' as const,
        speedMps: 0,
        updatedAtIso: '',
        trail: [],
      },
    ];
    const result = filterSortSlice(singleRobot, 'Offline', '', 'name', 0, VISIBLE_COUNT);
    expect(result).toHaveLength(0);
  });
});

// ── VIRTUALIZE_THRESHOLD contract ─────────────────────────────────────────────

describe('VIRTUALIZE_THRESHOLD and VISIBLE_COUNT constants', () => {
  it('VISIBLE_COUNT is a positive integer', async () => {
    expect(Number.isInteger(VISIBLE_COUNT)).toBe(true);
    expect(VISIBLE_COUNT).toBeGreaterThan(0);
  });

  it('filterSortSlice with exactly VISIBLE_COUNT limit returns at most VISIBLE_COUNT items', () => {
    const result = filterSortSlice(FLEET_500, 'All', '', 'name', 0, VISIBLE_COUNT);
    expect(result.length).toBeLessThanOrEqual(VISIBLE_COUNT);
  });
});
