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
       '6': ^21.0.0
       '7': ^22.0.0
   ```

2. Add an icon at `icons/<name>.svg` (or `.png`).
3. Run `pnpm sync <name> <repo>` to auto-fill `description`, `npm`, `github`, `type`, `maintainers`, `archived`.
4. Commit both files and open a PR.

## Schema

| Field | Manual | Auto-filled | Notes |
|---|:-:|:-:|---|
| `name` | ✓ | | Must match the filename. |
| `repo` | ✓ | | `org/name` on GitHub. |
| `icon` | ✓ | | Filename in `/icons/`. |
| `website` | ✓ | | Project / docs URL. |
| `category` | ✓ | | One of the 14 categories below. |
| `compatibility.adonis` | ✓ | | Map of AdonisJS major version → semver range. |
| `aliases` | ✓ | | Optional list of old names. |
| `description` | | ✓ | From upstream `package.json`. |
| `npm` | | ✓ | From upstream `package.json`. |
| `github` | | ✓ | Derived from `repo`. |
| `type` | | ✓ | `official` if owner is `adonisjs`, else `3rd-party`. |
| `maintainers` | optional | ✓ if empty | Manual entries are preserved. |
| `archived` | | ✓ | Set from GitHub. |

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

## License

MIT
