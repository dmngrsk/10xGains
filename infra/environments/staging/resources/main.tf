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
  environment = "staging"
  location    = "westeurope"

  # Absent credentials leave DNS unmanaged and the environment on its generated hostname.
  # nonsensitive: whether a token was supplied is not itself a secret, and without this the
  # app URL inherits the mark and every output derived from it fails to render.
  dns_configured = nonsensitive(var.cloudflare_api_token != "" && var.cloudflare_zone_id != "")
  custom_domain  = "staging-10xgains.dmngrsk.pl"

  tags = {
    application = "10xgains"
    environment = local.environment
    managed-by  = "terraform"
  }
}

data "azurerm_resource_group" "env" {
  name = "rg-10xgains-staging"
}

resource "supabase_project" "main" {
  organization_id   = var.supabase_organization_id
  name              = "10xGains Staging"
  region            = "eu-central-1"
  database_password = var.supabase_database_password


  lifecycle {
    ignore_changes = [database_password]
  }
}

module "supabase" {
  source      = "../../../modules/supabase"
  project_ref = supabase_project.main.id
  site_url    = module.azure.app_url
  redirect_urls = concat(
    ["${module.azure.app_url}/auth/callback"],
    local.dns_configured ? ["https://${local.custom_domain}", "https://${local.custom_domain}/auth/callback"] : []
  )

  email_autoconfirm = true

  google_client_id     = var.supabase_google_client_id
  google_client_secret = var.supabase_google_client_secret
}

module "dns" {
  source = "../../../modules/dns"
  count  = local.dns_configured ? 1 : 0

  environment = local.environment
  hostname    = local.custom_domain
  zone_id     = var.cloudflare_zone_id

  static_web_app_id               = module.azure.swa_id
  static_web_app_default_hostname = module.azure.swa_default_hostname
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

  allowed_origins = local.dns_configured ? ["https://${local.custom_domain}"] : []

  app_url_override = local.dns_configured ? "https://${local.custom_domain}" : null

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

output "supabase_url" { value = module.supabase.url }
output "supabase_project_ref" { value = supabase_project.main.id }
output "supabase_google_callback_url" { value = module.supabase.google_callback_url }

output "supabase_publishable_key" {
  value     = module.supabase.publishable_key
  sensitive = true
}
