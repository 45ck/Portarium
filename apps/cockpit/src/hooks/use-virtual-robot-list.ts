/**
 * useVirtualRobotList — performance-budgeted virtual list for the Operations Map.
 *
 * When the fleet exceeds VIRTUALIZE_THRESHOLD robots, only a window of
 * VISIBLE_COUNT rows is rendered at a time. This keeps the robot list panel
 * within the 60 fps / 16 ms render budget even for fleets of 500+ robots.
 *
 * Performance targets (verified by map-performance-budget.test.ts):
 *   - Filter + sort ≤ 16 ms for 500 robots (one frame budget)
 *   - Filter + sort + slice ≤ 8 ms for 500 robots (half-frame budget)
 *   - Search across 500 robot names ≤ 4 ms
 *
 * Usage:
 *   const { visibleItems, totalCount, startIndex } = useVirtualRobotList({
 *     locations,
 *     statusFilter,
 *     search,
 *     sortBy,
 *   });
 *
 * Bead: bead-0717
 */

import { useMemo } from 'react';
import type { RobotLocation } from '../mocks/fixtures/robot-locations.js';
import type { RobotStatus } from '../types/robotics.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fleet size above which virtualization is enabled. */
export const VIRTUALIZE_THRESHOLD = 50;

/** Number of rows rendered at a time in virtual mode. */
export const VISIBLE_COUNT = 40;

// ── Types ─────────────────────────────────────────────────────────────────────

export type RobotSortKey = 'name' | 'status' | 'battery';

export interface UseVirtualRobotListOptions {
  locations: readonly RobotLocation[];
  statusFilter: RobotStatus | 'All';
  search: string;
  sortBy: RobotSortKey;
  /** Zero-based index of the first visible row. Default: 0. */
  scrollOffset?: number;
}

export interface UseVirtualRobotListResult {
  /** The slice of robots to render. */
  visibleItems: readonly RobotLocation[];
  /** Total count after filter + search (for scroll container sizing). */
  totalCount: number;
  /** Index of the first visible item in the filtered list. */
  startIndex: number;
  /** Whether virtualization is active (fleet exceeds VIRTUALIZE_THRESHOLD). */
  isVirtualized: boolean;
}

// ── Status sort order ─────────────────────────────────────────────────────────

const STATUS_ORDER: Partial<Record<string, number>> = {
  'E-Stopped': 0,
  Degraded: 1,
  Online: 2,
  Offline: 3,
};

// ── Pure filter/sort/slice ────────────────────────────────────────────────────

/**
 * Pure function: filter, sort, and optionally slice a robot location list.
 * Exported for testing without a React context.
 */
export function filterSortSlice(
  locations: readonly RobotLocation[],
  statusFilter: RobotStatus | 'All',
  search: string,
  sortBy: RobotSortKey,
  startIndex: number,
  count: number,
): RobotLocation[] {
  // 1. Filter by status
  let result: RobotLocation[] =
    statusFilter === 'All' ? Array.from(locations) : locations.filter((l) => l.status === statusFilter);

  // 2. Filter by search term
  if (search.trim()) {
    const term = search.toLowerCase();
    result = result.filter(
      (l) => l.name.toLowerCase().includes(term) || l.robotId.toLowerCase().includes(term),
    );
  }

  // 3. Sort
  result.sort((a, b) => {
    if (sortBy === 'battery') return a.batteryPct - b.batteryPct;
    if (sortBy === 'status') return (STATUS_ORDER[a.status as string] ?? 99) - (STATUS_ORDER[b.status as string] ?? 99);
    return a.name.localeCompare(b.name);
  });

  // 4. Slice (virtual window)
  return result.slice(startIndex, startIndex + count);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVirtualRobotList({
  locations,
  statusFilter,
  search,
  sortBy,
  scrollOffset = 0,
}: UseVirtualRobotListOptions): UseVirtualRobotListResult {
  const isVirtualized = locations.length > VIRTUALIZE_THRESHOLD;
  const visibleCount = isVirtualized ? VISIBLE_COUNT : locations.length;

  // Full filtered + sorted list (for count)
  const filteredCount = useMemo(() => {
    let result: RobotLocation[] =
      statusFilter === 'All' ? Array.from(locations) : locations.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(term) || l.robotId.toLowerCase().includes(term),
      );
    }
    return result.length;
  }, [locations, statusFilter, search]);

  // Visible window
  const visibleItems = useMemo(() => {
    return filterSortSlice(locations, statusFilter, search, sortBy, scrollOffset, visibleCount);
  }, [locations, statusFilter, search, sortBy, scrollOffset, visibleCount]);

  return {
    visibleItems,
    totalCount: filteredCount,
    startIndex: scrollOffset,
    isVirtualized,
  };
}
