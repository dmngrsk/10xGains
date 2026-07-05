# GitHub Actions Workflows

Guidelines for working on CI/CD workflows in this repository:

- Check `package.json` scripts (root and workspace packages) before wiring build/test steps; Node version comes from `.nvmrc`.
- This repo deploys to `main`; verify branch assumptions with `git branch -a` before referencing branches.
- Attach `env:` variables and secrets to jobs instead of declaring them globally on the workflow.
- Use `pnpm install --frozen-lockfile` for dependency setup (pnpm via `pnpm/action-setup`, Node via `actions/setup-node` with `cache: 'pnpm'`).
- Extract common steps into composite actions in separate files when they repeat across workflows.
- When adding or updating a public action, check its latest major version:

  ```bash
  curl -s https://api.github.com/repos/{owner}/{repo}/releases/latest | grep '"tag_name":' | sed -E 's/.*"v([0-9]+).*/\1/'
  ```

  and verify the action is not deprecated or archived:

  ```bash
  curl -s https://api.github.com/repos/{owner}/{repo} | grep '"archived":'
  ```

  For linter issues related to action parameters, fetch the action definition directly:

  ```bash
  curl -s https://raw.githubusercontent.com/{owner}/{repo}/refs/heads/main/action.yml
  ```

## Deployment specifics

- The CD chain is `database` (Supabase migrations) → `backend-api` (Azure Functions) → `frontend` (Azure Static Web App) → `e2e`. The frontend calls the API, so the SWA deploy must stay ordered after the Functions deploy.
- Both apps are built in CI (`build-web` and `build-api` run in parallel) and passed to CD as `dist-web-<environment>` / `dist-api-<environment>` artifacts; CD jobs only download and deploy. This relies on CI and CD running in the same workflow run.
- The Azure Functions deploy uses OIDC (`azure/login@v3` + `Azure/functions-action@v1` with `remote-build: true`, `sku: flexconsumption`). Jobs using OIDC need `permissions: id-token: write`, and reusable-workflow callers must grant it too.
