resource "azuread_application_registration" "cd" {
  display_name = var.application_name
  description  = "GitHub Actions deployment identity for the ${var.environment} environment."
}

resource "azuread_service_principal" "cd" {
  client_id = azuread_application_registration.cd.client_id
}

resource "azuread_application_federated_identity_credential" "github" {
  application_id = azuread_application_registration.cd.id
  display_name   = "github-10xgains-env-${var.environment}"
  description    = "GitHub Actions OIDC for the ${var.environment} environment."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repository}:environment:${var.environment}"
}

data "azurerm_resource_group" "env" {
  name = var.resource_group_name
}

resource "azurerm_role_assignment" "contributor" {
  scope                = data.azurerm_resource_group.env.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}

resource "azurerm_role_assignment" "tfstate" {
  scope                = var.tfstate_container_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}
