resource "azurerm_static_web_app_custom_domain" "main" {
  static_web_app_id = var.static_web_app_id
  domain_name       = var.hostname
  validation_type   = "dns-txt-token"
}

resource "cloudflare_dns_record" "app" {
  zone_id = var.zone_id
  name    = var.hostname
  type    = "CNAME"
  content = var.static_web_app_default_hostname
  proxied = true
  ttl     = 1 # ttl must be 1 while proxied; Cloudflare rejects an explicit value.
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
