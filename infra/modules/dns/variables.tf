variable "environment" { type = string }

variable "hostname" {
  # First-level under the zone: Cloudflare's Universal SSL covers the apex and one label, so a
  # proxied `staging.10xgains.dmngrsk.pl` has no certificate and fails the TLS handshake.
  description = "Fully qualified name to bind, e.g. staging-10xgains.dmngrsk.pl."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone. Supplied rather than looked up so the token needs only DNS:Edit."
  type        = string
}

variable "static_web_app_id" { type = string }
variable "static_web_app_default_hostname" { type = string }
