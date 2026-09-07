# Remote Supabase configuration.
#
# ┌─ READ THIS BEFORE ADDING `supabase_project` HERE ───────────────────────────────────────────┐
# │ The project resource deliberately lives in each environment root, NOT in this module.       │
# │                                                                                             │
# │ `lifecycle` arguments accept only literals, so `prevent_destroy` cannot be a variable.      │
# │ Production carries `prevent_destroy = true`; staging must stay freely destroyable for the   │
# │ experimentation loop (spec §6.4). Moving the project in here would force one behaviour on   │
# │ both — and on a free-tier project with no point-in-time recovery, losing that protection    │
# │ means an unrecoverable production database (spec §11.1).                                    │
# │                                                                                             │
# │ This module is named `supabase` for symmetry with `azure`; the name is not a claim to own   │
# │ every Supabase resource.                                                                    │
# └─────────────────────────────────────────────────────────────────────────────────────────────┘
#
# What lives here is the policy that should be identical across environments apart from its URLs.
# Two hand-maintained copies of the same JSON is exactly how they would drift.
#
# NOTE: `supabase/config.toml` does NOT configure any of this. That file governs the *local*
# stack only. Before this resource existed, the remote equivalents were portal state nobody had
# reviewed (spec §4.5). Changing config.toml has no effect here, and vice versa.
#
# Arguments are serialised JSON matching the Management API, so this is config-shaped rather than
# strongly typed — a wrong key name fails at apply, not at plan.

# One group per colon-separated segment, and a password must contain a character from each. The
# `\\:` in the symbol group is an escaped colon, not a separator — this is Supabase's own default
# string, and the groups match passwordStrengthValidator in the web app.
# Google's own OAuth client is not Terraformable — there is no public GCP API for Web-application
# client IDs — so the credentials arrive as variables and the authorized redirect URI is still
# pasted in by hand (spec §9). Without both, the block is omitted rather than half-applied:
# enabling the provider with no client would break sign-in outright.
locals {
  # An unset GitHub Actions var renders as "", which a null check alone would accept — and the
  # provider would then be enabled with no client at all. Empty and null both mean "not configured".
  # Compared explicitly rather than via coalesce, which errors when every argument is empty.
  google_configured = alltrue([for v in [var.google_client_id, var.google_client_secret] : v != null && v != ""])

  # A zero-or-one list, not `cond ? {...} : {}`: that form unifies its branches into map(string) and
  # every bool here arrives at the API as "true"/"false", which it rejects. A list keeps the object
  # type intact, and merge() expands it below.
  google = local.google_configured ? [{
    external_google_enabled          = true
    external_google_client_id        = var.google_client_id
    external_google_secret           = var.google_client_secret
    external_google_skip_nonce_check = false
    external_google_email_optional   = false
  }] : []

  password_required_characters = "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~"
}

resource "supabase_settings" "main" {
  project_ref = var.project_ref

  api = jsonencode({
    db_schema            = "public,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })

  # A fresh project ships with none of this: passwords accepted at 6 characters with no character
  # classes, and manual identity linking off — so the web app's own form is stricter than the
  # service behind it, and the Google link/unlink controls in settings fail server-side.
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
