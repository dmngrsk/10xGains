# Wired straight into the Function App's app settings. This single expression is what Bicep
# cannot write, and the reason Terraform was chosen (spec §1.1, §2).
output "publishable_key" {
  value     = data.supabase_apikeys.main.publishable_key
  sensitive = true
}

output "url" { value = "https://${var.project_ref}.supabase.co" }

# Register this against the Google OAuth client by hand. It carries the project ref, so a rebuilt
# project needs a new entry — until then, Google sign-in fails with redirect_uri_mismatch.
output "google_callback_url" { value = "https://${var.project_ref}.supabase.co/auth/v1/callback" }
