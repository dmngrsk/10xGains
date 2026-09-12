output "publishable_key" {
  value     = data.supabase_apikeys.main.publishable_key
  sensitive = true
}

output "url" { value = "https://${var.project_ref}.supabase.co" }

output "google_callback_url" { value = "https://${var.project_ref}.supabase.co/auth/v1/callback" }
