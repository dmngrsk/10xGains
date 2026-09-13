output "resource_group_name" { value = azurerm_resource_group.env.name }
output "state_account_name" { value = azurerm_storage_account.state.name }
output "admin_container_id" { value = azurerm_storage_container.admin.id }

output "tfstate_container_id" {
  description = "Scope for the CD principal's grant in identity/."
  value       = azurerm_storage_container.tfstate.id
}
