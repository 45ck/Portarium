output "state_bucket_name" {
  description = "S3 bucket name for Terraform remote state. Use as the `bucket` value in backend.tf."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_region" {
  description = "AWS region where the state bucket is provisioned. Use as the `region` value in backend.tf."
  value       = var.aws_region
}

output "lock_table_name" {
  description = "DynamoDB table name for state locking. Use as the `dynamodb_table` value in backend.tf."
  value       = aws_dynamodb_table.tfstate_lock.name
}

output "kms_key_arn" {
  description = "KMS key ARN used to encrypt state objects. Reference if you need explicit key access policies."
  value       = aws_kms_key.tfstate.arn
}

output "backend_config_snippet" {
  description = "Paste this block into infra/terraform/<stack>/backend.tf to enable remote state for that stack."
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.tfstate.bucket}"
        key            = "<stack-name>/terraform.tfstate"
        region         = "${var.aws_region}"
        dynamodb_table = "${aws_dynamodb_table.tfstate_lock.name}"
        encrypt        = true
        kms_key_id     = "${aws_kms_key.tfstate.arn}"
      }
    }
  EOT
}
