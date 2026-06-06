# AdonisJS Packages

> Discover the AdonisJS packages to add database, auth, ORM, queue, payment and more integrations into your AdonisJS application.

- 🔗 [Packages listing](https://adonisjs.com/packages)
- 📖 [Package author guide](https://docs.adonisjs.com/guides/packages-development)

## Packages Database

Metadata of AdonisJS packages are maintained in [yml](https://en.wikipedia.org/wiki/YAML) files inside the [./packages](./packages) directory and automatically synced from upstream to fetch latest information.

### Add/Update a package

```bash
pnpm sync <name> <repo>
```

Example: `pnpm sync lucid adonisjs/lucid`

To sync with a branch different than the default, suffix the repo with `#repo-branch`, example: `pnpm sync lucid adonisjs/lucid#next`.

### Contribution

- If you feel a package is missing, please create a new [issue](https://github.com/adonisjs-community/packages/issues/new).
- If some data is outdated please directly open a pull request.

### Using CDN

Compiled JSON data is available from following CDNs:

- **jsdelivr:** https://cdn.jsdelivr.net/npm/@adonisjs/packages@latest/db.json
- **unpkg:** https://unpkg.com/@adonisjs/packages@latest/db.json

### Using npm package

You can use the `@adonisjs/packages` package by installing it in your project:

```bash
# npm
npm install @adonisjs/packages

# pnpm
pnpm add @adonisjs/packages
```

Then you can directly import the list of packages:

```ts
import db from '@adonisjs/packages'
//      ^? { generatedAt, version, categories, packages }
```

### Schema

| Field              | Auto sync | Description                                                                                                                  |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `name`             | No        | Canonical name. Must match the filename. |
| `description`      | Yes       | Short description, pulled from upstream `package.json`. |
| `repo`             | No        | GitHub repository. Format is `org/name` or `org/name#branch`. |
| `npm`              | Yes       | NPM package name. |
| `icon`             | No        | Icon of the package from the [./icons](./icons) directory. |
| `github`           | Yes       | GitHub URL, derived from `repo`. |
| `website`          | No        | Project / docs URL. |
| `category`         | No        | One of the [supported categories](./lib/categories.ts). |
| `type`             | Yes       | `official` (for [adonisjs](https://github.com/adonisjs/)) or `3rd-party`. |
| `maintainers`      | Yes (if empty) | List of maintainers — each item has `name`, `github`, optional `twitter` / `bluesky`. Manual entries are preserved. |
| `compatibility`    | No        | `compatibility.adonis` is a map of AdonisJS major (e.g. `6`, `7`) → label (`6.x`, `7.x`). Keys declare supported majors. |
| `aliases`          | No        | Optional list of old names. |
| `lastCommitAt`     | Bot       | ISO date of default-branch HEAD commit. |
| `lastReleaseAt`    | Bot       | ISO date of latest npm publish. |
| `latestNpmVersion` | Bot       | Latest npm version on `latest` dist-tag. |
| `status`           | Bot       | `healthy` / `stale` / `archived`. Bot auto-sets `archived`/`healthy`; `stale` only via the dashboard PR. |

## Maintenance

### Auto update all current packages

```bash
pnpm sync
```

### Generate `db.json`

```bash
pnpm build
```

## Healthiness bot

A weekly GitHub Action keeps the bot-owned metadata fields (`lastCommitAt`, `lastReleaseAt`, `latestNpmVersion`, `status`) fresh by auto-committing directly to `main`. It also maintains a long-lived **Dependency Dashboard** issue (label: `bot:dashboard`) listing actionable curation calls — currently only `Mark as status: stale` proposals (no compat-range or "claim adonis N support" suggestions, since only the package author can verify those).

Tick the checkbox in the dashboard issue → a `bot/healthcheck/<id>` PR opens with that single change.

### One-time setup (maintainer)

1. Repo Settings → Actions → General → **Workflow permissions**: Read and write permissions; check **Allow GitHub Actions to create and approve pull requests**.
2. Create a GitHub App scoped to this repo with: Contents read/write, Issues read/write, Pull requests read/write, Metadata read. Install on the repo.
3. Add two repo secrets: `BOT_APP_ID` and `BOT_APP_PRIVATE_KEY`.
4. Pre-create labels `bot:dashboard` and `bot:auto-pr` on the repo.

Trigger `Healthcheck (weekly)` manually via the Actions tab to kick off the first run.

## License

[MIT](./LICENSE) — Made with ❤️ by the AdonisJS community
