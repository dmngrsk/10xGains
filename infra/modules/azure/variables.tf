variable "environment" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }

variable "function_app_name" { type = string }
variable "service_plan_name" { type = string }
variable "storage_account_name" { type = string }
variable "app_insights_name" { type = string }
variable "log_analytics_name" { type = string }

variable "maximum_instance_count" {
  description = "Blast-radius ceiling on scale-out, not a capacity estimate. See api-rate-limiting.md §3.1."
  type        = number
  default     = 10
}

variable "http_concurrency" {
  description = "In-flight requests per instance."
  type        = number
  default     = 16
}

variable "instance_memory_in_mb" {
  type    = number
  default = 2048
}

variable "log_analytics_daily_quota_gb" {
  description = "Cost cap. Note this also caps observability — ingestion stops for the day when hit."
  type        = number
  default     = 0.1
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "static_web_app_name" { type = string }

variable "app_url_override" {
  description = <<-DESC
    Public URL of the web app, when it is not the Static Web App's own hostname.

    Production is fronted by 10xgains.dmngrsk.pl, so its APP_URL must be the domain rather than
    the Azure-generated hostname. Staging leaves this null and takes the SWA hostname, which
    changes on every rebuild and is picked up automatically.
  DESC
  type        = string
  default     = null
}

variable "supabase_url" { type = string }

variable "supabase_publishable_key" {
  type      = string
  sensitive = true
}

variable "allowed_origins" {
  description = "CORS origins for the Function App. Must be known at plan time; see the cors block."
  type        = list(string)
  default     = []
}
