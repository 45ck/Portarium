"""
Portarium tool wrapper for OpenAI Agents SDK.

Routes all tool calls through the Portarium control plane, ensuring
policy evaluation, approval gates, and evidence capture.
"""

import os
import functools
from typing import Any, Callable

from portarium_client import AuthenticatedClient
from portarium_client.api.runs import start_run, get_run
from portarium_client.models import StartRunRequest


def get_portarium_client() -> AuthenticatedClient:
    """Create a Portarium client from environment variables."""
    return AuthenticatedClient(
        base_url=os.environ["PORTARIUM_BASE_URL"],
        token=os.environ["PORTARIUM_TOKEN"],
        headers={"X-Workspace-Id": os.environ["PORTARIUM_WORKSPACE_ID"]},
    )


def portarium_tool(
    workflow_id: str,
    action_type: str,
) -> Callable:
    """
    Decorator that routes a tool call through Portarium.

    Instead of executing the tool function directly, this submits a workflow
    run to Portarium with the tool's arguments as input. The tool function
    itself is never called -- Portarium's execution plane handles the actual
    SoR interaction.

    Args:
        workflow_id: The Portarium workflow definition to invoke.
        action_type: The action type for policy evaluation (e.g., "invoice:create").
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(**kwargs: Any) -> dict:
            client = get_portarium_client()
            workspace_id = os.environ["PORTARIUM_WORKSPACE_ID"]

            # Submit the tool call as a Portarium run
            run = start_run.sync(
                client=client,
                workspace_id=workspace_id,
                body=StartRunRequest(
                    workflow_id=workflow_id,
                    input={
                        "action_type": action_type,
                        "tool_name": func.__name__,
                        "parameters": kwargs,
                    },
                ),
            )

            # Poll for completion (in production, use webhooks or SSE)
            import time

            while run.status in ("Pending", "Running", "WaitingApproval"):
                time.sleep(2)
                run = get_run.sync(
                    client=client,
                    workspace_id=workspace_id,
                    run_id=run.id,
                )

            if run.status == "Succeeded":
                return run.output or {"status": "completed"}
            else:
                return {"error": f"Run {run.id} ended with status: {run.status}"}

        return wrapper

    return decorator
