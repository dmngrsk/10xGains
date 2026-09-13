locals {
  app_url = coalesce(var.app_url_override, "https://${azurerm_static_web_app.main.default_host_name}")
}

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

  https_only = true

  app_settings = {
    SUPABASE_URL             = var.supabase_url
    SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
    APP_URL                  = local.app_url
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.main.connection_string

    dynamic "cors" {
      for_each = length(var.allowed_origins) > 0 ? [1] : []
      content {
        allowed_origins = var.allowed_origins
      }
    }
  }

  tags = var.tags
}
