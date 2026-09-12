# Without this, Terraform infers `hashicorp/supabase` from the resource prefix and fails to find
# it. A module must declare the source address of every non-hashicorp provider it uses.
terraform {
  required_version = ">= 1.9"

  required_providers {
    supabase = { source = "supabase/supabase", version = "~> 1.11" }
  }
}
