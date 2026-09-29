variable "region" { type = string }

# Named profile to authenticate with, so a run does not depend on what happens to be
# exported in the shell. Empty falls back to the provider's default chain — that is the
# CI path, where credentials come from an OIDC role and no profile exists.
variable "aws_profile" {
  type    = string
  default = ""
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["stage", "prod"], var.environment)
    error_message = "environment must be \"stage\" or \"prod\"."
  }
}

variable "root_domain" {
  type = string
}

variable "subdomain" {
  type = string
}




variable "auth0_domain" {
  type = string
}

variable "auth0_client_id" {
  type = string
}

variable "auth0_client_secret" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}


locals {
  app_domain = "${var.subdomain}.${var.root_domain}"
  name       = "flash-sale-${var.environment}"
}
