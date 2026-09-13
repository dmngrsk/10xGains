output "client_id" {
  description = <<-DESC
    Set as AZURE_CLIENT_ID on this environment's GitHub environment — never as a repository-level
    secret, or both environments would share one identity and the split would not take effect.
  DESC
  value       = azuread_application_registration.cd.client_id
}

output "service_principal_object_id" { value = azuread_service_principal.cd.object_id }
