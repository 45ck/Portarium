"""
OpenClaw before_tool_call / after_tool_call hooks for Portarium integration.

These hooks intercept tool invocations and route them through the Portarium
control plane for policy evaluation and evidence capture.
"""

import os
import logging
from typing import Any

from portarium_policy import PortariumPolicyClient

logger = logging.getLogger(__name__)

# Initialize the policy client (singleton per gateway process)
_policy_client = PortariumPolicyClient(
    base_url=os.environ.get("PORTARIUM_BASE_URL", "http://localhost:3000"),
    token=os.environ["PORTARIUM_TOKEN"],
    workspace_id=os.environ["PORTARIUM_WORKSPACE_ID"],
)


def before_tool_call(
    tool_name: str,
    tool_args: dict[str, Any],
    agent_id: str,
    run_id: str,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """
    Called by OpenClaw before executing a tool.

    Returns:
        dict with keys:
          - "allow": bool -- whether to proceed with the tool call
          - "reason": str -- human-readable reason (for deny or audit)
          - "modified_args": dict | None -- optionally modified tool args
    """
    logger.info(
        "before_tool_call: tool=%s agent=%s run=%s",
        tool_name,
        agent_id,
        run_id,
    )

    # Evaluate policy
    result = _policy_client.evaluate_tool_call(
        tool_name=tool_name,
        tool_args=tool_args,
        agent_id=agent_id,
        run_id=run_id,
        correlation_id=correlation_id,
    )

    if result.decision == "Deny":
        logger.warning(
            "Tool call DENIED: tool=%s reason=%s",
            tool_name,
            result.reason,
        )
        return {
            "allow": False,
            "reason": result.reason,
            "modified_args": None,
        }

    if result.decision == "HumanApprove":
        logger.info(
            "Tool call requires approval: tool=%s approval_id=%s",
            tool_name,
            result.approval_id,
        )
        # Block until approval is granted (or timeout)
        approved = _policy_client.wait_for_approval(
            approval_id=result.approval_id,
            timeout_seconds=300,
        )
        if not approved:
            return {
                "allow": False,
                "reason": f"Approval timed out or denied for {tool_name}",
                "modified_args": None,
            }

    return {
        "allow": True,
        "reason": result.reason or "Policy allows execution",
        "modified_args": None,
    }


def after_tool_call(
    tool_name: str,
    tool_args: dict[str, Any],
    tool_result: Any,
    agent_id: str,
    run_id: str,
    success: bool,
    error: str | None = None,
    correlation_id: str | None = None,
) -> None:
    """
    Called by OpenClaw after a tool execution completes.
    Records the result as evidence in the Portarium audit trail.
    """
    logger.info(
        "after_tool_call: tool=%s success=%s agent=%s run=%s",
        tool_name,
        success,
        agent_id,
        run_id,
    )

    _policy_client.record_evidence(
        tool_name=tool_name,
        tool_args=tool_args,
        tool_result=tool_result if success else None,
        agent_id=agent_id,
        run_id=run_id,
        success=success,
        error=error,
        correlation_id=correlation_id,
    )
