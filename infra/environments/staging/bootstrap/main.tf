terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 5.4" }
    azuread = { source = "hashicorp/azuread", version = "~> 3.9" }
  }

  # Self-hosting: this root's state lives in the `admin` container it creates. On a first run the
  # block is commented out (local state), then restored and migrated with
  # `terraform init -migrate-state`. Never commit the resulting local state — it records the
  # storage account keys, and this repository is public.
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# Authenticates against Microsoft Graph separately from azurerm. The applying user needs
# Application.ReadWrite.All or ownership of the registration.
provider "azuread" {}

# Everything an Owner sets up once, and CI never touches: the resource group the environment
# lives in, the Terraform state backend, and the identity CI authenticates as.
#
# One root rather than two because the split bought nothing — both are Owner-applied, applied
# together and destroyed together — while forcing the container id to be passed between them by
# hand. Here it is a direct reference.

module "bootstrap" {
  source = "../../../modules/bootstrap"

  environment           = "staging"
  resource_group_name   = "rg-10xgains-staging"
  state_account_name    = "st10xgtfstatestaging"
  operator_principal_id = var.operator_principal_id
}

module "identity" {
  source = "../../../modules/identity"

  environment          = "staging"
  application_name     = "github-10xgains-staging"
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
