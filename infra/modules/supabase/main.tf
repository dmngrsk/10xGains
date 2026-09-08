# Remote Supabase configuration. `supabase/config.toml` governs the local stack only and has no
# effect here.
#
# `supabase_project` lives in each environment root, not here: `prevent_destroy` accepts only
# literals, and production needs it while staging must stay destroyable (spec §6.4, §11.1).

locals {
  # Both or neither. An unset GitHub Actions var renders as "", and coalesce errors when every
  # argument is empty, so each is compared explicitly.
  google_configured = alltrue([for v in [var.google_client_id, var.google_client_secret] : v != null && v != ""])

  # Zero-or-one list, never `cond ? {...} : {}` — that unifies the branches to map(string) and
  # every bool reaches the API quoted.
  google = local.google_configured ? [{
    external_google_enabled          = true
    external_google_client_id        = var.google_client_id
    external_google_secret           = var.google_client_secret
    external_google_skip_nonce_check = false
    external_google_email_optional   = false
  }] : []

  # `\\:` is an escaped colon within the symbol group, not a separator.
  password_required_characters = "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~"
}

resource "supabase_settings" "main" {
  project_ref = var.project_ref

  api = jsonencode({
    db_schema            = "public,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })

  auth = jsonencode(merge({
    site_url       = var.site_url
    uri_allow_list = join(",", concat([var.site_url], var.redirect_urls))

    disable_signup                   = false
    external_email_enabled           = true
    external_anonymous_users_enabled = false
    mailer_autoconfirm               = var.email_autoconfirm

    password_min_length          = 8
    password_required_characters = local.password_required_characters

    mailer_secure_email_change_enabled    = true
    refresh_token_rotation_enabled        = true
    security_refresh_token_reuse_interval = 10
    security_manual_linking_enabled       = true
  }, local.google...))
}

data "supabase_apikeys" "main" {
  project_ref = var.project_ref
}
