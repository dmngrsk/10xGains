variable "environment" { type = string }
variable "application_name" { type = string }
variable "resource_group_name" { type = string }

variable "tfstate_container_id" {
  description = "The environment's `tfstate` container. NOT the `admin` container — see main.tf."
  type        = string
}

variable "github_repository" {
  type    = string
  default = "dmngrsk/10xGains"
}
