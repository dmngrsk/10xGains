# Applied by infra:apply, never by CD: a Cloudflare token scopes to a whole zone, so one that
# could write this hostname could also rewrite the zone's MX records. Subdomain zones, which would
# scope it properly, are Enterprise-only on the parent.

# TXT rather than cname-delegation: the record is proxied, so a CNAME check resolves to Cloudflare
# rather than the origin and never validates (spec §9 M2). The provider does not poll for TXT
# completion, so this returns with its token instead of blocking.
resource "azurerm_static_web_app_custom_domain" "main" {
  static_web_app_id = var.static_web_app_id
  domain_name       = var.hostname
  validation_type   = "dns-txt-token"
}

# ttl must be 1 while proxied; Cloudflare rejects an explicit value.
resource "cloudflare_dns_record" "app" {
  zone_id = var.zone_id
  name    = var.hostname
  type    = "CNAME"
  content = var.static_web_app_default_hostname
  proxied = true
  ttl     = 1
  comment = "Managed by Terraform (infra/modules/dns) — ${var.environment}"
}

resource "cloudflare_dns_record" "validation" {
  zone_id = var.zone_id
  name    = "_dnsauth.${var.hostname}"
  type    = "TXT"
  content = azurerm_static_web_app_custom_domain.main.validation_token
  proxied = false
  ttl     = 300
  comment = "Azure Static Web App domain validation for ${var.hostname}"
}
