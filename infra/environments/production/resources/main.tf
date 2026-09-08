terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm    = { source = "hashicorp/azurerm", version = "~> 5.4" }
    supabase   = { source = "supabase/supabase", version = "~> 1.11" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.24" }
  }

  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  environment   = "production"
  location      = "westeurope"
  custom_domain = "10xgains.dmngrsk.pl"

  # Absent credentials leave DNS unmanaged and the environment on its generated hostname.
  # nonsensitive: whether a token was supplied is not itself a secret, and without this the
  # app URL inherits the mark and every output derived from it fails to render.
  dns_configured = nonsensitive(var.cloudflare_api_token != "" && var.cloudflare_zone_id != "")

  tags = {
    application = "10xgains"
    environment = local.environment
    managed-by  = "terraform"
  }
}

data "azurerm_resource_group" "env" {
  name = "rg-10xgains-prod"
}

resource "supabase_project" "main" {
  organization_id   = var.supabase_organization_id
  name              = "10xGains Production"
  region            = "eu-central-1"
  database_password = var.supabase_database_password


  lifecycle {
    # No point-in-time recovery on the free tier, and the two-project cap means a replace could
    # delete this one then fail to create its replacement. Deleting it is manual (spec §9 M14).
    prevent_destroy = true

    ignore_changes = [database_password]
  }
}

module "supabase" {
  source      = "../../../modules/supabase"
  project_ref = supabase_project.main.id

  site_url      = "https://${local.custom_domain}"
  redirect_urls = ["https://${local.custom_domain}/auth/callback"]

  google_client_id     = var.supabase_google_client_id
  google_client_secret = var.supabase_google_client_secret
}

module "dns" {
  source = "../../../modules/dns"
  count  = local.dns_configured ? 1 : 0

  environment = local.environment
  hostname    = "10xgains.dmngrsk.pl"
  zone_id     = var.cloudflare_zone_id

  static_web_app_id               = module.azure.swa_id
  static_web_app_default_hostname = module.azure.swa_default_hostname
}

module "azure" {
  source              = "../../../modules/azure"
  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.env.name
  location            = data.azurerm_resource_group.env.location

  function_app_name    = "func-10xgains-prod"
  service_plan_name    = "asp-10xgains-prod"
  storage_account_name = "st10xgainsapiprod"
  app_insights_name    = "appi-10xgains-prod"
  log_analytics_name   = "log-10xgains-prod"
  static_web_app_name  = "swa-10xgains-prod"

  app_url_override = "https://${local.custom_domain}"

  allowed_origins = local.dns_configured ? ["https://${local.custom_domain}"] : []

  supabase_url             = module.supabase.url
  supabase_publishable_key = module.supabase.publishable_key

  tags = local.tags
}

variable "subscription_id" { type = string }

variable "cloudflare_zone_id" {
  type    = string
  default = ""
}

variable "cloudflare_api_token" {
  description = "Zone:DNS:Edit. Empty leaves DNS unmanaged."
  type        = string
  sensitive   = true
  default     = ""
}
variable "supabase_organization_id" { type = string }

variable "supabase_database_password" {
  description = "Must match secrets.SUPABASE_DB_PASSWORD, or CI's `supabase db push` breaks."
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase personal access token. Falls back to SUPABASE_ACCESS_TOKEN when null."
  type        = string
  sensitive   = true
  default     = null
}

variable "supabase_google_client_id" {
  description = "Google OAuth client ID. Null leaves the provider unmanaged on this project."
  type        = string
  default     = null
}

variable "supabase_google_client_secret" {
  description = "Google OAuth client secret. Null leaves the provider unmanaged on this project."
  type        = string
  sensitive   = true
  default     = null
}

output "api_url" { value = module.azure.api_url }
output "app_url" { value = module.azure.app_url }
output "swa_default_hostname" {
  description = "Origin for the dns root's CNAME record."
  value       = module.azure.swa_default_hostname
}
output "supabase_url" { value = module.supabase.url }
output "supabase_publishable_key" {
  value     = module.supabase.publishable_key
  sensitive = true
}

output "supabase_project_ref" { value = supabase_project.main.id }

output "supabase_google_callback_url" { value = module.supabase.google_callback_url }

output "static_web_app_id" { value = module.azure.swa_id }
output "static_web_app_default_hostname" { value = module.azure.swa_default_hostname }
