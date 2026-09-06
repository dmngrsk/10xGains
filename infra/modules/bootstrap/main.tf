# One environment's Terraform state backend, living in that environment's own resource group.
#
# Scoped per environment on purpose. A module managing several environments would have to keep its
# state somewhere, and wherever that was would couple the environments together: destroying the
# environment that happened to host it would erase the record of the others. Here, staging's
# scaffolding state describes only staging, so destroying staging loses nothing that matters.

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

  # Load-bearing. Contributor on the resource group cannot read blobs directly, but it *can* call
  # listKeys and read them with the account key. Disabling shared-key access removes that path,
  # leaving the container-scoped role assignments as the only way in — which is what makes it safe
  # to keep state inside the resource group it describes.
  shared_access_key_enabled = false

  # Makes the Azure Portal default to Entra auth when browsing, instead of failing on key access.
  default_to_oauth_authentication = true

  blob_properties {
    # Versioning is what recovers a truncated or corrupted state file; soft delete alone is not
    # enough. It does not apply retroactively, so it must be on before any state is written.
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

# Scaffolding state (bootstrap, identity) — operator only, never granted to a CD principal.
#
# Separate from `tfstate` because role assignments are container-scoped: a principal granted the
# environment's state container would otherwise also read bootstrap state, which records the
# storage account's own keys.
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
