resource "azurerm_resource_group" "env" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    application = "10xgains"
    environment = var.environment
    managed-by  = "terraform-bootstrap"
  }
}

resource "azurerm_storage_account" "state" {
  name                = var.state_account_name
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location

  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"

  allow_nested_items_to_be_public = false
  shared_access_key_enabled = false
  default_to_oauth_authentication = true

  blob_properties {
    versioning_enabled = true

    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }
  }

  tags = {
    application = "10xgains"
    environment = var.environment
    managed-by  = "terraform-bootstrap"
    purpose     = "terraform-state"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"

  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_container" "admin" {
  name                  = "admin"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"

  lifecycle { prevent_destroy = true }
}

resource "azurerm_role_assignment" "operator_tfstate" {
  scope                = azurerm_storage_container.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.operator_principal_id
}

resource "azurerm_role_assignment" "operator_admin" {
  scope                = azurerm_storage_container.admin.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.operator_principal_id
}
