output "budget_name" {
  description = "AWS Budget name."
  value       = aws_budgets_budget.monthly.name
}

output "anomaly_monitor_arn" {
  description = "ARN of the Cost Anomaly Monitor."
  value       = aws_ce_anomaly_monitor.portarium.arn
}

output "config_rule_name" {
  description = "AWS Config required-tags rule name."
  value       = aws_config_config_rule.required_tags.name
}
