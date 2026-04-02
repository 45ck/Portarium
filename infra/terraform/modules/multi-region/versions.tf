terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.secondary]
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
