output "url" { value = "https://${var.hostname}" }

output "binding_status" { value = azurerm_static_web_app_custom_domain.main.id }
