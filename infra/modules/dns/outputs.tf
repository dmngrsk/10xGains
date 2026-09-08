output "url" { value = "https://${var.hostname}" }

# Azure validates asynchronously, so a successful apply means the records exist, not that the
# binding is live. Check this before pointing anything at the hostname.
output "binding_status" { value = azurerm_static_web_app_custom_domain.main.id }
