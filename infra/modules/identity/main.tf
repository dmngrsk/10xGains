# One environment's CI deployment identity.
#
# NEVER APPLIED BY CI. An identity that can write its own federated credentials can add one
# trusting any repository, branch or environment and assume itself from there. Granting a CD
# principal the Graph permissions to manage this would make the per-environment split worthless,
# because either principal could mint the other. Applied by a human with subscription Owner and
# Microsoft Graph permissions.
#
# Scoped per environment on purpose. A single application carrying two federated credentials —
# the arrangement this replaces — resolves to one service principal holding both resource groups'
# role assignments, so a workflow running in staging received a token that could write production.

resource "azuread_application_registration" "cd" {
  display_name = var.application_name
  description  = "GitHub Actions deployment identity for the ${var.environment} environment."
}

# Role assignments target the service principal's object id, not the application id.
resource "azuread_service_principal" "cd" {
  client_id = azuread_application_registration.cd.client_id
}

# The subject must match the workflow's environment exactly. A typo surfaces as a CI auth failure
# that reads like a missing secret rather than a wrong one.
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

# Scoped to one resource group. This is the boundary that stops a staging workflow reaching
# production; never widen it to the subscription.
resource "azurerm_role_assignment" "contributor" {
  scope                = data.azurerm_resource_group.env.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}

# Container scope, and deliberately only the `tfstate` container. The sibling `admin` container
# holds bootstrap and identity state — including the storage account's own keys — and no CD
# principal is ever granted it.
#
# Combined with `shared_access_key_enabled = false` on the account, this is the only path to
# state: Contributor on the resource group cannot read blobs, and there is no account key to fall
# back on.
resource "azurerm_role_assignment" "tfstate" {
  scope                = var.tfstate_container_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.cd.object_id
}
