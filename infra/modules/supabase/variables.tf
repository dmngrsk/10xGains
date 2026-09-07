variable "project_ref" {
  description = "Project ref from the supabase_project resource in the environment root."
  type        = string
}

variable "site_url" {
  description = "Primary redirect target after auth. Per-environment."
  type        = string
}

variable "redirect_urls" {
  description = "Additional allowed redirect URLs. Per-environment."
  type        = list(string)
  default     = []
}

# Staging cannot send mail — no custom SMTP, and the built-in sender only reaches project members —
# so a verification requirement there is one nobody can satisfy, including AUTH-02.
variable "email_autoconfirm" {
  description = "Treat an address as verified at signup instead of mailing a confirmation link. Per-environment."
  type        = bool
  default     = false
}

# Both or neither: see the `google` local. Null on an environment whose redirect URI has not been
# registered with Google yet, which leaves the project's provider settings untouched.
variable "google_client_id" {
  description = "Google OAuth client ID for Supabase sign-in."
  type        = string
  default     = null
}

variable "google_client_secret" {
  description = "Google OAuth client secret. Read from the environment; never committed."
  type        = string
  sensitive   = true
  default     = null
}
