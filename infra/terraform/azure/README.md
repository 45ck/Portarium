# Azure Terraform reference (planned)

Azure implementation is intentionally not implemented in this milestone.

The AWS stack (`infra/terraform/aws`) is the first provider-specific baseline.
Once the same architectural contract is stabilized, add:

- AKS cluster + managed identity/workload identity integration
- PostgreSQL Flexible Server with network isolation controls
- WORM-capable immutable artifact container strategy
- Vault integration (external secret connector, Azure Key Vault)
- Tenant network isolation policy as a second-pass module

Use this folder to keep the Azure parity implementation with the same input/output
interface as the AWS baseline where possible.
