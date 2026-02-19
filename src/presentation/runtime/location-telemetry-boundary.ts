import type { AppContext } from '../../application/common/context.js';
import type { Forbidden, ValidationFailed } from '../../application/common/errors.js';
import { APP_ACTIONS } from '../../application/common/actions.js';
import type { WorkspaceUserRole } from '../../domain/primitives/index.js';
import { parseIsoDate } from '../../domain/validation/parse-utils.js';

export type LocationTelemetryAccessMode = 'live' | 'history' | 'download';
export type LocationTelemetryAccessPurpose =
  | 'operations'
  | 'incident-response'
  | 'compliance-audit';

export type LocationTelemetryBoundaryRequest = Readonly<{
  mode: LocationTelemetryAccessMode;
  purpose: LocationTelemetryAccessPurpose;
  fromIso?: string;
  toIso?: string;
}>;

export type LocationTelemetryBoundaryPolicy = Readonly<{
  liveRoles: readonly WorkspaceUserRole[];
  historyRoles: readonly WorkspaceUserRole[];
  downloadRoles: readonly WorkspaceUserRole[];
  retentionDays: number;
  maxHistoryWindowHours: number;
}>;

export type LocationTelemetryBoundaryError = Forbidden | ValidationFailed;

export const DEFAULT_LOCATION_TELEMETRY_POLICY: LocationTelemetryBoundaryPolicy = {
  liveRoles: ['admin', 'operator', 'approver'],
  historyRoles: ['admin', 'operator', 'auditor'],
  downloadRoles: ['admin', 'auditor'],
  retentionDays: 30,
  maxHistoryWindowHours: 24 * 7,
} as const;

export function enforceLocationTelemetryBoundary(
  ctx: AppContext,
  req: LocationTelemetryBoundaryRequest,
  policy: LocationTelemetryBoundaryPolicy = DEFAULT_LOCATION_TELEMETRY_POLICY,
  now = new Date(),
): { ok: true } | { ok: false; error: LocationTelemetryBoundaryError } {
  const roleCheck = checkRoles(ctx.roles, req.mode, policy);
  if (!roleCheck.ok) {
    return roleCheck;
  }

  const purposeCheck = checkPurpose(req.mode, req.purpose);
  if (!purposeCheck.ok) {
    return purposeCheck;
  }

  if (req.mode === 'history' || req.mode === 'download') {
    const windowCheck = checkWindow(req, policy, now);
    if (!windowCheck.ok) {
      return windowCheck;
    }
  }

  return { ok: true };
}

function checkRoles(
  roles: readonly WorkspaceUserRole[],
  mode: LocationTelemetryAccessMode,
  policy: LocationTelemetryBoundaryPolicy,
): { ok: true } | { ok: false; error: Forbidden } {
  const allowedRoles =
    mode === 'live'
      ? policy.liveRoles
      : mode === 'history'
        ? policy.historyRoles
        : policy.downloadRoles;
  if (allowedRoles.some((role) => roles.includes(role))) {
    return { ok: true };
  }
  return {
    ok: false,
    error: {
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: `Role does not allow ${mode} location telemetry access.`,
    },
  };
}

function checkPurpose(
  mode: LocationTelemetryAccessMode,
  purpose: LocationTelemetryAccessPurpose,
): { ok: true } | { ok: false; error: Forbidden } {
  if (mode === 'live' && purpose === 'compliance-audit') {
    return {
      ok: false,
      error: {
        kind: 'Forbidden',
        action: APP_ACTIONS.workspaceRead,
        message: 'compliance-audit purpose is not allowed for live telemetry stream access.',
      },
    };
  }
  if (mode === 'download' && purpose === 'operations') {
    return {
      ok: false,
      error: {
        kind: 'Forbidden',
        action: APP_ACTIONS.workspaceRead,
        message: 'operations purpose is not allowed for telemetry export/download.',
      },
    };
  }
  return { ok: true };
}

function checkWindow(
  req: LocationTelemetryBoundaryRequest,
  policy: LocationTelemetryBoundaryPolicy,
  now: Date,
): { ok: true } | { ok: false; error: LocationTelemetryBoundaryError } {
  if (!req.fromIso || !req.toIso) {
    return {
      ok: false,
      error: {
        kind: 'ValidationFailed',
        field: 'fromIso/toIso',
        message: 'fromIso and toIso are required for history/download location telemetry access.',
      },
    };
  }

  let fromDate: Date;
  let toDate: Date;
  try {
    fromDate = parseIsoDate(req.fromIso, 'fromIso', Error);
    toDate = parseIsoDate(req.toIso, 'toIso', Error);
  } catch {
    return {
      ok: false,
      error: {
        kind: 'ValidationFailed',
        field: 'fromIso/toIso',
        message: 'fromIso/toIso must be valid ISO timestamps.',
      },
    };
  }

  if (toDate < fromDate) {
    return {
      ok: false,
      error: {
        kind: 'ValidationFailed',
        field: 'toIso',
        message: 'toIso must be on or after fromIso.',
      },
    };
  }

  const windowMs = toDate.getTime() - fromDate.getTime();
  const maxWindowMs = policy.maxHistoryWindowHours * 60 * 60 * 1000;
  if (windowMs > maxWindowMs) {
    return {
      ok: false,
      error: {
        kind: 'ValidationFailed',
        field: 'toIso',
        message: `Requested history window exceeds maxHistoryWindowHours (${policy.maxHistoryWindowHours}).`,
      },
    };
  }

  const oldestAllowedMs = now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000;
  if (fromDate.getTime() < oldestAllowedMs) {
    return {
      ok: false,
      error: {
        kind: 'Forbidden',
        action: APP_ACTIONS.workspaceRead,
        message: `Requested history starts before retention window (${policy.retentionDays} days).`,
      },
    };
  }

  return { ok: true };
}
