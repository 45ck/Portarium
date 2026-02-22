locals {
  prefix = "${var.namespace}-${var.environment}"
}

# ---------------------------------------------------------------------------
# Azure platform implementation — parity with infra/terraform/aws/
# See infra/terraform/README.md for planned module set.
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "platform" {
  name     = "${local.prefix}-rg"
  location = var.location

  tags = merge(var.tags, {
    ManagedBy = "terraform"
  })
}
