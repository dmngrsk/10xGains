# One environment's Terraform state backend, in that environment's own resource group — so
# destroying an environment erases only its own record.

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

  # Load-bearing: Contributor cannot read blobs directly but can call listKeys. Disabling shared
  # keys leaves the container-scoped role assignments as the only way in.
  shared_access_key_enabled = false

  # Makes the Azure Portal default to Entra auth when browsing, instead of failing on key access.
  default_to_oauth_authentication = true

  blob_properties {
    # Recovers a truncated state file where soft delete cannot, and is not retroactive — so it must
    # be on before any state is written.
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

# Environment state. The CD principal for this environment is granted access here by identity/.
resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"

  lifecycle { prevent_destroy = true }
}

# Scaffolding state (bootstrap, identity) — operator only. Separate from `tfstate` because
# role assignments are container-scoped, and this state records the account's own keys.
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
