# @adonisjs/packages

> Registry of community and official AdonisJS packages.

The metadata is maintained as YAML files in [`./packages`](./packages) and built into a single `db.json` published as [`@adonisjs/packages`](https://www.npmjs.com/package/@adonisjs/packages) on npm. The [adonisjs.com/packages](https://adonisjs.com/packages) page consumes that data.

## Add a package

The entire flow takes ~3 minutes if you have Node ≥22.6 and pnpm installed.

### 1. Fork and clone

```bash
gh repo fork adonisjs-community/packages --clone --remote
cd packages
pnpm install
```

### 2. Pick a unique `<name>`

The package's filename (and `name` field) — the slug shown on `adonisjs.com/packages`. Conventions:
- lowercase, no spaces, hyphens for word breaks (e.g., `bull-queue`, not `bull_queue`)
- for scoped npm packages like `@nemoventures/adonis-jobs`, drop the scope: `nemo-adonisjs-jobs` or similar
- must not collide with anything already in `/packages/`

### 3. Add a square icon

Drop an SVG or PNG into `/icons/`, named `<name>.svg` (or `.png`/`.jpg`/`.webp`).
- SVGs are preferred — scale to any size, smallest file
- ideal aspect ratio: 1:1 (square)
- ideal source: the project's own logo (look in their docs/README)
- if you don't have one, skip — a maintainer can add one later

### 4. Write the yml

Create `packages/<name>.yml` with the **manual fields only**. Everything else (`description`, `npm`, `github`, `type`, `maintainers`) is auto-filled by sync in step 5.

```yaml
name: bull-queue
repo: rlanz/bull-queue
icon: bull-queue.svg
website: https://github.com/rlanz/bull-queue
category: Messaging
compatibility:
  adonis:
    '6': 6.x
    '7': 7.x
```

Notes:
- **`compatibility.adonis` keys** = the AdonisJS majors your package supports. Values are always `<key>.x` (literal `6.x`, `7.x`, etc. — never a semver range of your own package's versions).
- **`website`** = the most-canonical landing page. Project's docs site if it has one; otherwise the GitHub repo URL.
- **`category`** = pick one from the [14 categories below](#categories). If none fit, open an issue first to discuss adding a new one.

### 5. Run `pnpm sync`

This validates the yml, fetches `description` + `npm` + `maintainers` from upstream, and writes everything back in canonical order. Required before committing.

```bash
cp .env.example .env  # paste any GitHub PAT (no scopes needed) — raises rate limit
pnpm sync <name> <repo>
# e.g.: pnpm sync bull-queue rlanz/bull-queue
```

If sync errors out, fix the cause (the message is usually explicit — wrong category, missing icon, malformed compat) and re-run.

### 6. Verify everything builds

```bash
pnpm check
```

Should print `Build completed`. If oxfmt complains, run `pnpm format` first then re-check.

### 7. Open the PR

```bash
git checkout -b add-<name>
git add packages/<name>.yml icons/<name>.*
git commit -m "feat(packages): add <name>"
git push -u origin add-<name>
gh pr create --title "Add <name>" --body "Adds [<name>](https://github.com/<repo>) to the registry."
```

That's it. A maintainer will review and merge.

### Updating an existing package

Same flow, but skip step 2/3 (use the existing name/icon) and edit the existing yml. If you're only changing data that sync would refresh anyway (compat, website), just run `pnpm sync <name>` and commit the diff.

## Schema

| Field | Manual | Auto-filled | Notes |
|---|:-:|:-:|---|
| `name` | ✓ | | Must match the filename. |
| `repo` | ✓ | | `org/name` on GitHub. |
| `icon` | ✓ | | Filename in `/icons/`. |
| `website` | ✓ | | Project / docs URL. |
| `category` | ✓ | | One of the 14 categories below. |
| `compatibility.adonis` | ✓ | | Map of AdonisJS major version → label (e.g. `6.x`, `7.x`). Keys declare which majors the package supports. |
| `aliases` | ✓ | | Optional list of old names. |
| `description` | | ✓ sync | From upstream `package.json`. |
| `npm` | | ✓ sync | From upstream `package.json`. |
| `github` | | ✓ sync | Derived from `repo`. |
| `type` | | ✓ sync | `official` if owner is `adonisjs`, else `3rd-party`. |
| `maintainers` | optional | ✓ sync (if empty) | Manual entries preserved. |
| `lastCommitAt` | | ✓ bot | ISO date of default-branch HEAD commit. |
| `lastReleaseAt` | | ✓ bot | ISO date of latest npm publish. |
| `latestNpmVersion` | | ✓ bot | Latest npm version on `latest` dist-tag. |
| `status` | | ✓ bot | `healthy` / `stale` / `archived`. Bot auto-sets `archived`/`healthy`; `stale` only via dashboard PR. |

### Categories

Authentication, Authorization, Communication, Database, DevTools, Extensions, Messaging, Monitoring, Payment, Rendering, Security, Starter kits, Storage, Testing.

## Local setup

```bash
pnpm install
cp .env.example .env  # paste a GitHub PAT (no scopes needed)
pnpm sync lucid adonisjs/lucid  # sync a single package
pnpm sync                       # sync all packages
pnpm build                      # write db.json
pnpm check                      # lint + format-check + build
```

Requires Node ≥22.6 (for `--experimental-strip-types`).

## Consuming the data

```ts
import db from '@adonisjs/packages'
//      ^? { generatedAt, version, categories, packages }
```

Or via CDN:

- `https://cdn.jsdelivr.net/npm/@adonisjs/packages@latest/db.json`
- `https://unpkg.com/@adonisjs/packages@latest/db.json`

## Healthiness bot

A weekly GitHub Action keeps the bot-owned metadata fields (`lastCommitAt`, `lastReleaseAt`, `latestNpmVersion`, `status`) fresh by auto-committing directly to `main`. It also maintains a long-lived **Dependency Dashboard** issue (label: `bot:dashboard`) listing actionable curation calls:

- **Mark as `status: stale`** — when a package has had no commits in 18+ months AND doesn't claim compat with the current AdonisJS major.

Tick the checkbox in the dashboard issue → a `bot/healthcheck/<id>` PR opens with that single change. The cron itself never opens PRs.

The bot deliberately does **not** propose compat-range edits or "claim adonis N support" — those are decisions only the package author can make.

### One-time setup (maintainer)

1. Repo settings → Actions → General → **Workflow permissions**: Read and write permissions.
2. Same page: check **Allow GitHub Actions to create and approve pull requests**.
3. Create a GitHub App scoped to this repo with these permissions: Contents read/write, Issues read/write, Pull requests read/write, Metadata read. Install on the repo.
4. Add two repo secrets: `BOT_APP_ID` (the App ID number) and `BOT_APP_PRIVATE_KEY` (the App's `.pem` contents).
5. Pre-create labels `bot:dashboard` and `bot:auto-pr` on the repo.

To kick off the first run before the next Monday, trigger `Healthcheck (weekly)` manually via the Actions tab (`workflow_dispatch`).

## License

MIT
