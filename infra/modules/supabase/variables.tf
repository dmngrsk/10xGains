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
