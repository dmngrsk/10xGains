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
