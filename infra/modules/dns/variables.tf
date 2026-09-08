variable "environment" { type = string }

variable "hostname" {
  description = "Fully qualified name to bind, e.g. staging.10xgains.dmngrsk.pl."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone containing the hostname. Supplied rather than looked up, so the token needs only DNS:Edit and not Zone:Read."
  type        = string
}

variable "static_web_app_id" { type = string }
variable "static_web_app_default_hostname" { type = string }
