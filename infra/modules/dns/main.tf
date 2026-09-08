# The custom domain and the records that prove it, in one place.
#
# ┌─ WHY THIS IS NOT IN THE RESOURCES ROOT ─────────────────────────────────────────────────────┐
# │ A Cloudflare API token scopes to a whole zone — there is no record- or subdomain-level      │
# │ scoping, and the subdomain-zone setup that would provide one is Enterprise-only on the      │
# │ parent zone. A token CI could use to write staging.10xgains.dmngrsk.pl could equally        │
# │ rewrite the MX records for dmngrsk.pl.                                                      │
# │                                                                                             │
# │ So this root is applied locally by infra:apply, never by CD — the same boundary that        │
# │ already keeps the state backend and the CI identity out of CI (spec §11.3).                 │
# └─────────────────────────────────────────────────────────────────────────────────────────────┘

# TXT rather than CNAME delegation. The record is proxied, so a CNAME check resolves to
# Cloudflare's addresses rather than the azurestaticapps.net origin and never validates — the
# manual dance in spec §9 M2 exists only to work around that. TXT validation ignores the CNAME
# entirely, so the record stays proxied throughout.
#
# The provider does not poll for TXT completion ("terraform will not validate TXT validation
# records are complete"), so this returns with its token instead of blocking on a record that
# cannot exist yet. Azure validates asynchronously once the record below is in place.
resource "azurerm_static_web_app_custom_domain" "main" {
  static_web_app_id = var.static_web_app_id
  domain_name       = var.hostname
  validation_type   = "dns-txt-token"
}

# Proxied, so ttl must be 1 — Cloudflare assigns it and rejects an explicit value.
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
