locals {
  # Production pins this to the custom domain; staging follows the Static Web App's generated
  # hostname, so a rebuild propagates automatically instead of being chased through the CSP,
  # the CORS origins and the GitHub variables by hand.
  app_url = coalesce(var.app_url_override, "https://${azurerm_static_web_app.main.default_host_name}")
}

# The custom domain is deliberately absent.
#
# `azurerm_static_web_app_custom_domain` exists, but the 10xgains.dmngrsk.pl binding is manual
# (spec §9 M2): the Cloudflare record is *proxied*, so Azure's validation resolves Cloudflare's
# addresses rather than the azurestaticapps.net origin. Binding it requires setting the record
# DNS-only, validating, then re-proxying — a sequence that does not belong in a plan/apply loop.
#
# Note the default hostname is Azure-generated and will differ from the old one after a rebuild.
# That is fine: every consumer of it is derived from the output below rather than hand-copied.

resource "azurerm_static_web_app" "main" {
  name                = var.static_web_app_name
  resource_group_name = var.resource_group_name
  location            = var.location

  sku_tier = "Free"
  sku_size = "Free"

  tags = var.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = var.log_analytics_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  daily_quota_gb = var.log_analytics_daily_quota_gb

  tags = var.tags
}

resource "azurerm_application_insights" "main" {
  name                = var.app_insights_name
  resource_group_name = var.resource_group_name
  location            = var.location
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.main.id
  retention_in_days   = 90

  tags = var.tags
}

# Functions storage. Unlike the state accounts, this one keeps shared-key access: the Flex
# Consumption app authenticates to its deployment container with `storage_access_key`.
resource "azurerm_storage_account" "functions" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
  location            = var.location

  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"

  allow_nested_items_to_be_public = false

  tags = var.tags
}

resource "azurerm_storage_container" "deployment" {
  name                  = "app-package"
  storage_account_id    = azurerm_storage_account.functions.id
  container_access_type = "private"
}

resource "azurerm_service_plan" "main" {
  name                = var.service_plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "FC1"

  tags = var.tags
}

resource "azurerm_function_app_flex_consumption" "main" {
  name                = var.function_app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.functions.primary_blob_endpoint}${azurerm_storage_container.deployment.name}"
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.functions.primary_access_key

  runtime_name    = "node"
  runtime_version = "24"

  maximum_instance_count = var.maximum_instance_count
  instance_memory_in_mb  = var.instance_memory_in_mb
  http_concurrency       = var.http_concurrency

  # The observed apps accept plain HTTP. The SWA's HSTS header covers the web origin, not this
  # hostname, so a bearer token sent here over HTTP is exposed. See spec §4.1.
  https_only = true

  # The seam (spec §1.1). Both values are derived from the Supabase project rather than copied
  # by hand. Platform settings — AzureWebJobsStorage, APPLICATIONINSIGHTS_CONNECTION_STRING — are
  # injected by the provider from storage_access_key and application_insights_connection_string
  # and must NOT be repeated here.
  app_settings = {
    SUPABASE_URL             = var.supabase_url
    SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
    APP_URL                  = local.app_url
  }

  site_config {
    # Belongs here, not at the top level: the provider maps it onto the
    # APPLICATIONINSIGHTS_CONNECTION_STRING app setting, which is why that key must not appear in
    # `app_settings` above.
    application_insights_connection_string = azurerm_application_insights.main.connection_string

    # Deliberately no `cors` block. Hono owns CORS (spec §4.4) — it knows about
    # resolveAllowedOrigins(), it is unit-tested, and it lives with the routes it protects.
    # Configuring the Azure layer as well produced two controls that already disagreed.
  }

  tags = var.tags
}
