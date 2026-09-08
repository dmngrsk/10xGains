terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 5.4" }
    azuread = { source = "hashicorp/azuread", version = "~> 3.9" }
  }

  # Self-hosting: this root's state lives in the `admin` container it creates. First run comments
  # this out, then migrates with `terraform init -migrate-state`. Never commit that local state.
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# Authenticates against Microsoft Graph separately from azurerm. The applying user needs
# Application.ReadWrite.All or ownership of the registration.
provider "azuread" {}

# Everything an Owner sets up once and CI never touches: the resource group, the state backend,
# and the identity CI authenticates as. One root, so the container id is a direct reference.

module "bootstrap" {
  source = "../../../modules/bootstrap"

  environment           = "production"
  resource_group_name   = "rg-10xgains-prod"
  state_account_name    = "st10xgtfstateprod"
  operator_principal_id = var.operator_principal_id
}

module "identity" {
  source = "../../../modules/identity"

  environment          = "production"
  application_name     = "github-10xgains-production"
  resource_group_name  = module.bootstrap.resource_group_name
  tfstate_container_id = module.bootstrap.tfstate_container_id
}

variable "subscription_id" { type = string }
variable "operator_principal_id" { type = string }

output "resource_group_name" { value = module.bootstrap.resource_group_name }
output "state_account_name" { value = module.bootstrap.state_account_name }
output "tfstate_container_id" { value = module.bootstrap.tfstate_container_id }
output "admin_container_id" { value = module.bootstrap.admin_container_id }

output "client_id" {
  description = "Set as AZURE_CLIENT_ID on this environment's GitHub environment."
  value       = module.identity.client_id
}
