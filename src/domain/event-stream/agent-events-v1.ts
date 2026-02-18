/**
 * Agent lifecycle CloudEvents type catalogue (bead-0431).
 *
 * Canonical CloudEvents `type` strings for Portarium agent lifecycle events.
 * These follow the convention: `com.portarium.agent.<EventName>`
 *
 * Every event carries the mandatory Portarium extensions:
 *   - `tenantid`      : TenantId (workspace scope)
 *   - `correlationid` : CorrelationId (distributed trace)
 *   - `runid`         : RunId (the workflow run that triggered the action)
 *   - `actionid`      : ActionId (the specific action slot in the plan)
 */

/** Namespace prefix for all Portarium agent CloudEvents types. */
export const PORTARIUM_AGENT_EVENT_PREFIX = 'com.portarium.agent' as const;

/**
 * Typed CloudEvents type strings for agent lifecycle events.
 *
 * - `ActionDispatched`  : emitted when the control plane sends an action to a machine/agent runtime.
 * - `ActionCompleted`   : emitted when the machine/agent runtime reports successful completion.
 * - `ActionFailed`      : emitted when the machine/agent runtime reports a failure (includes error details).
 */
export const AGENT_CLOUD_EVENT_TYPES = {
  ActionDispatched: `${PORTARIUM_AGENT_EVENT_PREFIX}.ActionDispatched`,
  ActionCompleted: `${PORTARIUM_AGENT_EVENT_PREFIX}.ActionCompleted`,
  ActionFailed: `${PORTARIUM_AGENT_EVENT_PREFIX}.ActionFailed`,
} as const;

export type AgentCloudEventType =
  (typeof AGENT_CLOUD_EVENT_TYPES)[keyof typeof AGENT_CLOUD_EVENT_TYPES];

/** Source identifier used for agent lifecycle CloudEvents. */
export const AGENT_CLOUD_EVENT_SOURCE = 'portarium.control-plane.agent-runtime' as const;
