# CI/CD — Vercel Production Deploys

Production deploys are driven by GitHub Actions and happen **only when `master`
changes**. See [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

On every push to `master` the pipeline:

1. Installs dependencies (`pnpm install --frozen-lockfile`)
2. Lints with Biome (`pnpm lint`) — currently **non-blocking** (`continue-on-error`)
   because master has pre-existing format violations. Run `pnpm lint:fix`, commit,
   then remove `continue-on-error` in the workflow to make it a hard gate.
3. Fires the Vercel **deploy hook**, which builds and deploys the latest `master`
   commit to production. The build itself runs on Vercel, not in the Action.

No other branch deploys. Vercel's own Git auto-deploy is disabled for `master`
in [`vercel.json`](../vercel.json) (`git.deploymentEnabled.master = false`) so the
deploy hook (fired by this Action) is the single deployer — no double deploys.
Deploy hooks fire regardless of that setting.

## One-time setup

This pipeline needs the Vercel project connected to the repo and a single repo
secret. Do this once.

### 1. Connect the repo to a Vercel project

In the Vercel dashboard, import/connect this GitHub repo as a project. The deploy
hook builds the repo's `master` branch, so Vercel needs Git access to it.

### 2. Add the Vercel environment variables

Project → **Settings → Environment Variables**, add the values from
[`.env.example`](../.env.example) for the **Production** environment.
`FIREBASE_SERVICE_ACCOUNT_KEY_PATH` is local-only — on Vercel provide the service
account via the relevant `FIREBASE_*` / admin credentials your code reads.

Also set `CRON_SECRET` — the cron jobs in `vercel.json` (`/api/fx-rates`,
`/api/reminders`) rely on it.

### 3. Create the deploy hook

Project → **Settings → Git → Deploy Hooks**. Create a hook:

- **Name:** e.g. `master-production`
- **Branch:** `master`

Copy the generated URL. **Treat it as a secret** — anyone with it can trigger a
production build. If it ever leaks, delete and recreate it here.

### 4. Add the GitHub repo secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                    | Value                              |
| ------------------------- | ---------------------------------- |
| `VERCEL_DEPLOY_HOOK_URL`  | The deploy hook URL from step 3    |

Or via the CLI (paste the URL when prompted):

```bash
gh secret set VERCEL_DEPLOY_HOOK_URL
```

### 5. Trigger the first deploy

Push (or merge) to `master`. Watch the run under the repo's **Actions** tab, and
the resulting build under the project's **Deployments** in Vercel.
