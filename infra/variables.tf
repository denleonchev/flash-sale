variable "project_id" { type = string }
variable "zone" { type = string }
variable "region" { type = string }

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

variable "root_domain" {
  type = string
}

variable "subdomain" {
  type = string
}

locals {
  app_domain = "${var.subdomain}.${var.root_domain}"
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}
