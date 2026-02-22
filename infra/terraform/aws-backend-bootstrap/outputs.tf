output "state_bucket" {
  description = "S3 bucket name for Terraform remote state."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN of the Terraform state S3 bucket."
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table" {
  description = "DynamoDB table name for state locking."
  value       = aws_dynamodb_table.tfstate_lock.name
}

output "lock_table_arn" {
  description = "ARN of the DynamoDB lock table."
  value       = aws_dynamodb_table.tfstate_lock.arn
}

output "backend_config_snippet" {
  description = "Copy-paste-ready backend block for infra/terraform/aws/backend.tf."
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.tfstate.bucket}"
        key            = "portarium/aws/terraform.tfstate"
        region         = "${var.aws_region}"
        encrypt        = true
        dynamodb_table = "${aws_dynamodb_table.tfstate_lock.name}"
      }
    }
  EOT
}
