output "api_url" {
  description = "Feeds the web build's __API_URL__ and the CSP connect-src."
  value       = "https://${azurerm_function_app_flex_consumption.main.default_hostname}"
}

output "app_url" {
  value = local.app_url
}

output "swa_default_hostname" {
  description = "The origin to point the Cloudflare record at when rebinding the domain (§9 M2)."
  value       = azurerm_static_web_app.main.default_host_name
}

output "swa_id" {
  description = "Target for azurerm_static_web_app_custom_domain, which lives in the dns root."
  value       = azurerm_static_web_app.main.id
}
