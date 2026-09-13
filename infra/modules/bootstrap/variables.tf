variable "environment" { type = string }
variable "resource_group_name" { type = string }
variable "state_account_name" { type = string }

variable "location" {
  type    = string
  default = "westeurope"
}

variable "operator_principal_id" {
  description = <<-DESC
    Object ID of the human who applies this module.

    Needed because `shared_access_key_enabled = false` means the containers are reachable only
    through Entra, and subscription Owner does NOT confer data-plane access to blobs. Without this
    grant, `terraform init -migrate-state` cannot write the state it just created.

      az ad signed-in-user show --query id -o tsv
  DESC
  type        = string
}
