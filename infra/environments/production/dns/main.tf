terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm    = { source = "hashicorp/azurerm", version = "~> 5.4" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.24" }
  }

  # State lives in the admin container, which the CI principal has no access to — this root is
  # never applied by CD (see modules/dns/main.tf).
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "dns" {
  source      = "../../../modules/dns"
  environment = "production"
  hostname    = "10xgains.dmngrsk.pl"
  zone_id     = var.cloudflare_zone_id

  static_web_app_id               = var.static_web_app_id
  static_web_app_default_hostname = var.static_web_app_default_hostname
}

variable "subscription_id" { type = string }
variable "cloudflare_zone_id" { type = string }

variable "cloudflare_api_token" {
  description = "Needs Zone:DNS:Edit on this zone only. Never reaches CI."
  type        = string
  sensitive   = true
}

variable "static_web_app_id" { type = string }
variable "static_web_app_default_hostname" { type = string }

output "url" { value = module.dns.url }
