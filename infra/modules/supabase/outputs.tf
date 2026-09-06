# Wired straight into the Function App's app settings. This single expression is what Bicep
# cannot write, and the reason Terraform was chosen (spec §1.1, §2).
output "publishable_key" {
  value     = data.supabase_apikeys.main.publishable_key
  sensitive = true
}

output "url" {
  value = "https://${var.project_ref}.supabase.co"
}
