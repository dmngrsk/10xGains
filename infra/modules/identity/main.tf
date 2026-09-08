# One environment's CI deployment identity. Never applied by CI: an identity able to write its own
# federated credentials could add one trusting any repository and assume itself from there.
#
# One application per environment, because a single application with two federated credentials
# resolves to one service principal holding both resource groups' role assignments.

resource "azuread_application_registration" "cd" {
  display_name = var.application_name
  description  = "GitHub Actions deployment identity for the ${var.environment} environment."
}

# Role assignments target the service principal's object id, not the application id.
resource "azuread_service_principal" "cd" {
  client_id = azuread_application_registration.cd.client_id
}

# Must match the workflow's environment exactly; a typo reads like a missing secret, not a wrong one.
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

# The boundary that stops a staging workflow reaching production. Never widen to the subscription.
resource "azurerm_role_assignment" "contributor" {
  scope                = data.azurerm_resource_group.env.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}

# `tfstate` only — the sibling `admin` container holds bootstrap, identity and dns state and is
# never granted to CD. With `shared_access_key_enabled = false`, this is the only path to state:
# Contributor cannot read blobs and there is no account key.
resource "azurerm_role_assignment" "tfstate" {
  scope                = var.tfstate_container_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}
