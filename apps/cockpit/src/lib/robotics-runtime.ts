import {
  cockpitFlagEnabled,
  resolveCockpitRuntime,
  type CockpitRuntime,
} from '@/lib/cockpit-runtime';

export const ROBOTICS_LIVE_UNSUPPORTED_TITLE = 'Robotics unavailable in live mode';

export const ROBOTICS_LIVE_UNSUPPORTED_DETAIL =
  'Cockpit robotics currently uses simulated robot, mission, gateway, and safety fixtures. Live mode keeps this surface disabled until the control-plane contract exposes production telemetry and audited command endpoints.';

export const ROBOTICS_DEMO_NOTICE =
  'Demo robotics telemetry is simulated. It is not live hardware state, and operational safety commands are disabled unless a fresh live robotics command contract is available.';

export function shouldEnableRoboticsDemo(runtime: CockpitRuntime = resolveCockpitRuntime()) {
  return (
    runtime.allowDemoControls &&
    cockpitFlagEnabled(import.meta.env.VITE_PORTARIUM_ENABLE_ROBOTICS_DEMO, false)
  );
}

export function shouldEnableRoboticsQuery(
  workspaceId: string,
  enabled = true,
  runtime: CockpitRuntime = resolveCockpitRuntime(),
) {
  return Boolean(workspaceId) && enabled && shouldEnableRoboticsDemo(runtime);
}

export function assertRoboticsDemoRuntime(action: string): void {
  if (!shouldEnableRoboticsDemo()) {
    throw new Error(`${action} is unavailable in live Cockpit robotics mode.`);
  }
}
