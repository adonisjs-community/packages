# @adonisjs/packages

> Registry of community and official AdonisJS packages.

The metadata is maintained as YAML files in [`./packages`](./packages) and built into a single `db.json` published as [`@adonisjs/packages`](https://www.npmjs.com/package/@adonisjs/packages) on npm. The [adonisjs.com/packages](https://adonisjs.com/packages) page consumes that data.

## Add or update a package

1. Add a yml file at `packages/<name>.yml` with the minimum fields:

   ```yaml
   name: <name>
   repo: <github-org>/<repo-name>
   icon: <name>.svg
   website: https://...
   category: Database
   compatibility:
     adonis:
       '6': 6.x
       '7': 7.x
   ```

2. Add an icon at `icons/<name>.svg` (or `.png`).
3. Run `pnpm sync <name> <repo>` to auto-fill `description`, `npm`, `github`, `type`, `maintainers`.
4. Commit both files and open a PR.

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
