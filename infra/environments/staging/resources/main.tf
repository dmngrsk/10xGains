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
  environment = "staging"
  location    = "westeurope"

  tags = {
    application = "10xgains"
    environment = local.environment
    managed-by  = "terraform"
  }
}

# Owned by bootstrap/, read-only here. This is what makes it impossible for an environment plan to
# destroy the resource group or the state account living inside it (spec §3.6.1).
data "azurerm_resource_group" "env" {
  name = "rg-10xgains-staging"
}

# Declared here rather than in a module: `prevent_destroy` accepts only literals, and staging must
# stay freely destroyable for the experimentation phase (spec §6.4) while production must not.
resource "supabase_project" "main" {
  organization_id   = var.supabase_organization_id
  name              = "10xGains Staging"
  region            = "eu-central-1"
  database_password = var.supabase_database_password

  # instance_size is deliberately omitted — free tier by design (spec §3.4).

  lifecycle {
    ignore_changes = [database_password]
  }
}

module "supabase" {
  source        = "../../../modules/supabase"
  project_ref   = supabase_project.main.id
  site_url      = module.azure.app_url
  redirect_urls = ["${module.azure.app_url}/auth/callback"]

  email_autoconfirm = true
}

module "azure" {
  source              = "../../../modules/azure"
  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.env.name
  location            = data.azurerm_resource_group.env.location

  function_app_name    = "func-10xgains-staging"
  service_plan_name    = "asp-10xgains-staging"
  storage_account_name = "st10xgainsapistaging"
  app_insights_name    = "appi-10xgains-staging"
  log_analytics_name   = "log-10xgains-staging"
  static_web_app_name  = "swa-10xgains-staging"

  # No override: staging follows the Static Web App's generated hostname.
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

# Feed these into the GitHub environment variables the web build consumes.
output "api_url" { value = module.azure.api_url }
output "app_url" { value = module.azure.app_url }
output "supabase_url" { value = module.supabase.url }
output "supabase_publishable_key" {
  value     = module.supabase.publishable_key
  sensitive = true
}

output "supabase_project_ref" { value = supabase_project.main.id }
