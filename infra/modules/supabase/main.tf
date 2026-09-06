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

resource "supabase_settings" "main" {
  project_ref = var.project_ref

  api = jsonencode({
    db_schema            = "public,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })

  auth = jsonencode({
    site_url       = var.site_url
    uri_allow_list = join(",", concat([var.site_url], var.redirect_urls))
  })
}

data "supabase_apikeys" "main" {
  project_ref = var.project_ref
}
