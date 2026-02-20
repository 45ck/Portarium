"""
Example OpenAI Agents SDK agent with Portarium-routed tools.

All external actions route through the Portarium control plane for
policy evaluation, approval, and audit.
"""

from agents import Agent, Runner, function_tool
from portarium_tools import portarium_tool


# Define tools that route through Portarium
@function_tool
@portarium_tool(workflow_id="wf-invoice-create", action_type="invoice:create")
def create_invoice(customer_id: str, amount: float, currency: str = "USD") -> dict:
    """Create an invoice for a customer. Routed through Portarium for approval."""
    # This function body is never called directly.
    # Portarium's execution plane handles the actual SoR interaction.
    ...


@function_tool
@portarium_tool(workflow_id="wf-ticket-update", action_type="ticket:update")
def update_ticket(ticket_id: str, status: str, comment: str = "") -> dict:
    """Update a support ticket status. Routed through Portarium for audit."""
    ...


# Create the agent
agent = Agent(
    name="Portarium Demo Agent",
    instructions=(
        "You are a helpful assistant that can create invoices and update tickets. "
        "All actions are governed by Portarium policies and may require approval."
    ),
    tools=[create_invoice, update_ticket],
)


if __name__ == "__main__":
    result = Runner.run_sync(
        agent,
        "Create an invoice for customer cust-123 for $500 USD",
    )
    print(result.final_output)
