terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm  = { source = "hashicorp/azurerm", version = "~> 5.4" }
    supabase = { source = "supabase/supabase", version = "~> 1.11" }
  }

  # Values supplied at init time — never committed (spec §6.3.1).
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# Passing the token explicitly rather than relying on the ambient environment: a `terraform apply`
# run from a shell without SUPABASE_ACCESS_TOKEN exported fails partway through, after the Azure
# resources have already been created.
#
# The variable defaults to null, and a null argument is the same as an unset one — so CI, which
# has SUPABASE_ACCESS_TOKEN in its environment already, needs no tfvars entry.
provider "supabase" {
  access_token = var.supabase_access_token
}

locals {
  environment   = "production"
  location      = "westeurope"
  custom_domain = "10xgains.dmngrsk.pl"

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

  # instance_size deliberately omitted — free tier by design (spec §3.4).

  lifecycle {
    # The single most dangerous resource in this configuration. Free-tier projects carry no
    # point-in-time recovery, so a destroy is not recoverable — and the two-project cap means a
    # replace could delete this one then fail to create its replacement, leaving neither.
    # Deleting the old project during a rebuild is a deliberate manual act (spec §9 M14).
    prevent_destroy = true

    ignore_changes = [database_password]
  }
}

module "supabase" {
  source      = "../../../modules/supabase"
  project_ref = supabase_project.main.id

  # Captured from the portal before the rebuild (spec §7 item 3) — previously unmanaged state.
  site_url      = "https://${local.custom_domain}"
  redirect_urls = ["https://${local.custom_domain}/auth/callback"]
}

# The custom domain is NOT bound here — it is manual (spec §9 M2). The Cloudflare record is
# proxied, so Azure's validation sees Cloudflare rather than the origin.
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

  # Pinned to the custom domain, which is stable across a Static Web App rebuild.
  app_url_override = "https://${local.custom_domain}"

  supabase_url             = module.supabase.url
  supabase_publishable_key = module.supabase.publishable_key

  tags = local.tags
}

variable "subscription_id" { type = string }
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

output "api_url" { value = module.azure.api_url }
output "app_url" { value = module.azure.app_url }
output "swa_default_hostname" {
  description = "The origin to point the Cloudflare record at when rebinding the domain (§9 M2)."
  value       = module.azure.swa_default_hostname
}
output "supabase_url" { value = module.supabase.url }
output "supabase_publishable_key" {
  value     = module.supabase.publishable_key
  sensitive = true
}

output "supabase_project_ref" { value = supabase_project.main.id }
