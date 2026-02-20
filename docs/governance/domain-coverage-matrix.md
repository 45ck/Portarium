# Operational Domain Coverage Matrix

Source of truth: `docs/governance/domain-coverage-matrix.json`

- Review cadence: weekly
- Current cycle: `2026-W08`
- Reviewed at: `2026-02-20`
- Reviewed by: `codex-agent`
- CI enforcement: `src/infrastructure/testing/domain-coverage-matrix.test.ts`

This matrix maps each Portarium `PortFamily` to operational domain requirements (`marketing`, `finance`, `accounting`, `it-support`, `software-delivery`), canonical-object coverage, and active gap beads.

| Port family           | Operational domains                                        | Canonical objects                                                         | Coverage beads                        | Open gap beads                                                                                         | Status    |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| `FinanceAccounting`   | `finance`, `accounting`                                    | `Account`, `Invoice`, `Payment`, `Party`, `Order`                         | `bead-0223`, `bead-0224`              | `bead-0422`, `bead-0166`                                                                               | `partial` |
| `PaymentsBilling`     | `finance`, `accounting`                                    | `Payment`, `Invoice`, `Subscription`, `Product`, `Account`, `Party`       | `bead-0225`, `bead-0226`              | `bead-0166`, `bead-0174`                                                                               | `partial` |
| `ProcurementSpend`    | `finance`, `accounting`                                    | `Order`, `Invoice`, `Payment`, `Party`, `Subscription`, `Document`        | `bead-0227`, `bead-0228`              | `bead-0166`, `bead-0174`                                                                               | `partial` |
| `HrisHcm`             | `software-delivery`                                        | `Party`, `Subscription`                                                   | `bead-0229`, `bead-0230`              | `bead-0166`, `bead-0174`                                                                               | `gap`     |
| `Payroll`             | `finance`, `accounting`                                    | `Party`, `Payment`                                                        | `bead-0231`, `bead-0232`              | `bead-0166`, `bead-0174`                                                                               | `gap`     |
| `CrmSales`            | `marketing`                                                | `Party`, `Opportunity`, `Task`, `Campaign`, `Product`, `Order`, `Invoice` | `bead-0233`, `bead-0234`              | `bead-0166`, `bead-0174`                                                                               | `gap`     |
| `CustomerSupport`     | `it-support`                                               | `Ticket`, `Party`, `Document`                                             | `bead-0235`, `bead-0236`              | `bead-0423`, `bead-0166`                                                                               | `partial` |
| `ItsmItOps`           | `it-support`, `software-delivery`                          | `Ticket`, `Asset`, `Party`, `Document`, `Subscription`, `Product`         | `bead-0237`, `bead-0238`              | `bead-0413`, `bead-0166`                                                                               | `gap`     |
| `IamDirectory`        | `it-support`, `software-delivery`                          | `Party`, `Asset`                                                          | `bead-0239`, `bead-0240`              | `bead-0328`, `bead-0167`                                                                               | `partial` |
| `SecretsVaulting`     | `software-delivery`                                        | _(none)_                                                                  | `bead-0241`, `bead-0242`              | `bead-0327`, `bead-0167`                                                                               | `gap`     |
| `MarketingAutomation` | `marketing`                                                | `Party`, `Campaign`, `Document`                                           | `bead-0243`, `bead-0244`              | `bead-0421`, `bead-0166`                                                                               | `partial` |
| `AdsPlatforms`        | `marketing`                                                | `Campaign`, `Document`                                                    | `bead-0245`, `bead-0246`              | `bead-0403`, `bead-0166`                                                                               | `gap`     |
| `CommsCollaboration`  | `it-support`, `software-delivery`                          | `Party`, `Task`, `Document`                                               | `bead-0247`, `bead-0248`              | `bead-0403`, `bead-0166`                                                                               | `gap`     |
| `ProjectsWorkMgmt`    | `software-delivery`                                        | `Task`, `Party`, `Document`                                               | `bead-0249`, `bead-0250`              | `bead-0424`, `bead-0166`                                                                               | `partial` |
| `DocumentsEsign`      | `software-delivery`, `finance`, `accounting`               | `Document`, `Party`                                                       | `bead-0251`, `bead-0252`              | `bead-0166`, `bead-0174`                                                                               | `gap`     |
| `AnalyticsBi`         | `marketing`, `finance`, `accounting`, `software-delivery`  | `Party`                                                                   | `bead-0253`, `bead-0254`              | `bead-0428`, `bead-0166`                                                                               | `gap`     |
| `MonitoringIncident`  | `it-support`, `software-delivery`                          | `Ticket`, `Party`                                                         | `bead-0255`, `bead-0256`              | `bead-0413`, `bead-0393`                                                                               | `gap`     |
| `ComplianceGrc`       | `it-support`, `software-delivery`, `finance`, `accounting` | `Ticket`, `Asset`, `Document`, `Party`                                    | `bead-0257`, `bead-0258`              | `bead-0414`, `bead-0167`                                                                               | `gap`     |
| `RoboticsActuation`   | `it-support`, `software-delivery`                          | `Asset`, `ExternalObjectRef`                                              | `bead-0505`, `bead-0513`, `bead-0553` | `bead-0515`, `bead-0516`, `bead-0517`, `bead-0518`, `bead-0519`, `bead-0520`, `bead-0521`, `bead-0567` | `partial` |

## Notes

- `coverage` beads document family baseline and closeout evidence.
- `gap` beads are intentionally open and represent current closure blockers.
- The CI test fails if any `PortFamily` from `src/domain/primitives/index.ts` is missing or has no linked bead in the matrix data.
