# Infrastructure

Terraform for the Azure, Supabase and Cloudflare resources behind both environments.

```
pnpm infra:apply <staging|production>                        # provision or converge an environment
pnpm infra:apply <staging|production> --bootstrap-only       # only what CI cannot create for itself
pnpm infra:apply <staging|production> --check                # run preflight and stop
pnpm infra:destroy <staging|production>                      # tear one down
pnpm infra:destroy <staging|production> --keep-bootstrap     # keep the resource group, state backend and identity
```

## Layout

```
infra/
├── environments/<env>/
│   ├── bootstrap/main.tf        # resource group, state backend, CI identity   an Owner, never CI
│   └── resources/main.tf        # the environment itself                       CD, or an Owner locally
├── modules/
│   ├── bootstrap/               # resource group, state account, two containers, operator RBAC
│   ├── identity/                # Entra application, federated credential, scoped role assignments
│   ├── azure/                   # service plan, Function App, Static Web App, storage, App Insights, Log Analytics
│   ├── dns/                     # Cloudflare records and the Static Web App custom domain binding
│   └── supabase/                # remote project settings — auth policy, API exposure
└── scripts/
    ├── apply-environment.sh
    └── destroy-environment.sh
```

Everything about an environment lives under it and nothing spans two, so destroying one leaves no trace in the other. Each root keeps its state in that environment's own storage account.

The two roots exist because they have different appliers. `bootstrap/` creates the credentials CI authenticates with, so a pipeline that could apply it would be able to edit its own trust relationships. `resources/` is everything CD is allowed to touch.

`supabase_project` is declared in each `resources/` root rather than in `modules/supabase`, because `lifecycle` arguments accept only literals: production needs `prevent_destroy = true` and staging must stay freely destroyable.

## State

Two containers per state account, because Azure role assignments are container-scoped:

| Container | Holds | Granted to |
| --- | --- | --- |
| `tfstate` | `<env>.tfstate` — the resources root | the CI principal, and the operator |
| `admin` | `bootstrap.tfstate` — the state account's own keys | the operator only |

Shared-key access is disabled on the account, so container-scoped Entra grants are the only way in; subscription Owner alone does not confer data-plane access to blobs.

Backend configuration is never committed — this repository is public. Each root takes it at init time from a gitignored `backend.hcl` locally, or from `-backend-config` flags in CD. Secrets reach Terraform through `TF_VAR_*` rather than a generated tfvars file, so they never touch disk.

## Setting up a fresh environment

Three secrets must already exist on the `<env>` GitHub environment, because preflight refuses to run without them and this script never writes them: `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and `SUPABASE_ACCESS_TOKEN`. The `<env>-cd` environment needs its reviewers, and `.env` / `.env.<env>` need the Supabase and Cloudflare values. `--check` runs preflight and stops, which is the cheapest way to find out what is missing.

```
pnpm infra:apply <env> --check   # report what is missing, change nothing
pnpm infra:apply <env>           # build the whole environment locally
```

**If you want CD to build the environment, use `--bootstrap-only` instead.** It creates the resource group, state backend and CI identity, writes the GitHub environment, and stops — exactly the set CI cannot create for itself. Push and approve the gate, and CD applies the resources root, the migrations and both deploys.

```
pnpm infra:apply <env> --bootstrap-only
```

That is also the shape a production rebuild takes, so it is worth rehearsing on staging first. Either way the Google redirect URI is registered by hand afterwards — the apply prints the value.

## What `infra:apply` does

1. Create the resource group, state account and both containers, with the Azure CLI — Terraform needs the backend to exist before `init` can configure it.
2. Import those into Terraform and create the CI identity.
3. Apply the resources root: the Supabase project, then the Azure resources, DNS and settings.
4. Push the migrations and run the database tests.
5. Write this environment's GitHub variables and secrets.

`--bootstrap-only` stops after stage 2 and then writes the GitHub environment, which is exactly the set CI cannot create for itself. Everything after that CD can do.

## Not managed here

- The **Google OAuth redirect URI**. There is no public API for Web-application OAuth clients — the IAP-scoped one refuses redirect-URI updates — so the callback URL is registered by hand. It carries the Supabase project ref, so it changes on every rebuild, including after `infra:destroy --keep-bootstrap`; `infra:apply` prints the current value when it finishes.
- The **`Failure Anomalies` alert rules** Azure recreates alongside Application Insights.
- The **Supabase auth email templates**, which the Management API rejects on a project without custom SMTP.

DNS **is** managed here. Editing those Cloudflare records by hand will be reverted on the next deploy.

## Conventions

- One-line declarations for a bare `type` or a bare `value`; the block form when there is a description, a default or `sensitive`. Blocks are separated by a blank line, one-liners are not.
- `terraform fmt` must be clean, and every root must pass `terraform validate`.
- Roots declare their variables and outputs inline; modules use `variables.tf` and `outputs.tf`.
- Comments carry what the code cannot: why a resource is absent, why a value must be literal. The reasoning behind a decision belongs in a commit message, not beside the resource.
