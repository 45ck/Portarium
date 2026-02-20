"""
Portarium policy evaluation client for OpenClaw hooks.
"""

import time
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class PolicyResult:
    decision: str  # "Allow", "Deny", "HumanApprove"
    reason: str | None
    approval_id: str | None


class PortariumPolicyClient:
    """Client for Portarium policy evaluation and evidence recording."""

    def __init__(self, base_url: str, token: str, workspace_id: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._workspace_id = workspace_id
        self._http = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Workspace-Id": workspace_id,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    def evaluate_tool_call(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        agent_id: str,
        run_id: str,
        correlation_id: str | None = None,
    ) -> PolicyResult:
        """Submit a tool call for policy evaluation."""
        resp = self._http.post(
            f"/v1/workspaces/{self._workspace_id}/policy/evaluate",
            json={
                "action_type": tool_name,
                "agent_id": agent_id,
                "run_id": run_id,
                "correlation_id": correlation_id,
                "context": {"tool_args": tool_args},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return PolicyResult(
            decision=data["decision"],
            reason=data.get("reason"),
            approval_id=data.get("approvalId"),
        )

    def wait_for_approval(
        self,
        approval_id: str,
        timeout_seconds: int = 300,
    ) -> bool:
        """Poll for approval decision. Returns True if approved."""
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            resp = self._http.get(
                f"/v1/workspaces/{self._workspace_id}/approvals/{approval_id}",
            )
            resp.raise_for_status()
            data = resp.json()
            if data["status"] == "Approved":
                return True
            if data["status"] in ("Denied", "RequestChanges"):
                return False
            time.sleep(3)
        return False

    def record_evidence(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        tool_result: Any | None,
        agent_id: str,
        run_id: str,
        success: bool,
        error: str | None = None,
        correlation_id: str | None = None,
    ) -> None:
        """Record tool execution evidence."""
        self._http.post(
            f"/v1/workspaces/{self._workspace_id}/evidence",
            json={
                "category": "ToolExecution",
                "actor": agent_id,
                "run_id": run_id,
                "correlation_id": correlation_id,
                "payload": {
                    "tool_name": tool_name,
                    "tool_args": tool_args,
                    "tool_result": tool_result,
                    "success": success,
                    "error": error,
                },
            },
        )
