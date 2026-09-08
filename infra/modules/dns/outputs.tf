output "url" { value = "https://${var.hostname}" }

# Azure validates asynchronously: a successful apply means the records exist, not that the binding
# is live.
output "binding_status" { value = azurerm_static_web_app_custom_domain.main.id }
