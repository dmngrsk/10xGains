# Infrastructure

Terraform for the Azure and Supabase resources. Design and decisions live in
`docs/specs/infrastructure-as-code.md`.

```
pnpm infra:apply <staging|production>     provision or converge an environment
pnpm infra:destroy <staging|production>   tear one down
```

## Layout

Everything about an environment lives under it; nothing spans two. Each root keeps its state in
that environment's own storage account.

```
environments/<env>/bootstrap/   resource group, state backend, CI identity   an Owner, never CI
environments/<env>/resources/   the environment itself                        CI
```

Two containers per state account, because role assignments are container-scoped: CI is granted
`tfstate`, never `admin` — which holds the bootstrap state, and therefore the storage
account's own keys.

## Rules

- **`bootstrap/` is never applied by CI.** It writes the federated credentials CI authenticates
  with; a pipeline that can edit its own trust relationships has no boundary.
- **Backend config is never committed.** This repository is public. Each root takes it at init
  time from a gitignored `backend.hcl` or from environment secrets in CI.
- **Resource groups belong to `bootstrap/`.** `resources/` reads them through a `data` source, so an
  environment plan cannot destroy its own state account.

## Not managed here

DNS and the `10xgains.dmngrsk.pl` custom domain (Cloudflare, manual), and the `Failure Anomalies`
alert rules Azure recreates with Application Insights. Full register: spec §9.
