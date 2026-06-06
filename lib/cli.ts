import process from 'node:process'
import { cliui } from '@poppinss/cliui'
import { build } from './build.ts'
import { sync, syncAll } from './sync.ts'

const ui = cliui()

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  switch (command) {
    case 'sync':
      await runSync(args)
      break
    case 'build':
      await runBuild()
      break
    default:
      ui.logger.error(`Unknown command: ${command ?? '(none)'}`)
      ui.logger.info('Usage: cli.ts <sync|build> [args]')
      process.exit(1)
  }
}

async function runSync(args: string[]): Promise<void> {
  const [name, repo] = args
  if (name) {
    await runSingleSync(name, repo)
  } else {
    await runSyncAll()
  }
}

async function runSingleSync(name: string, repo?: string): Promise<void> {
  const action = ui.logger.action(`Syncing ${name}`).displayDuration()
  try {
    const { package: pkg, regressions } = await sync(name, repo, true)
    action.succeeded(`Synced ${pkg.name}`)

    if (regressions.length > 0) {
      ui.logger.warning(`Regressions detected (${regressions.length}):`)
      for (const r of regressions) {
        ui.logger.warning(`  [${r.type}] ${r.description}`)
      }
    }
    if (pkg.archived) {
      ui.logger.error(`Repository is archived`)
      process.exit(1)
    }
    ui.logger.success(`Sync completed successfully`)
  } catch (err) {
    action.failed(name, err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

async function runSyncAll(): Promise<void> {
  const result = await syncAll((current, total, name) => {
    ui.logger.info(`[${current}/${total}] ${name}`)
  })
  ui.logger.success(`Synced ${result.synced.length}/${result.total} packages`)

  if (result.errors.length > 0) {
    ui.logger.error(`Failed to sync ${result.errors.length} package(s):`)
    for (const e of result.errors) {
      ui.logger.error(`  ${e.packageName}: ${e.error.message}`)
    }
  }
  if (result.regressions.length > 0) {
    ui.logger.warning(`Regressions detected (${result.regressions.length}):`)
    for (const r of result.regressions) {
      ui.logger.warning(`  [${r.type}] ${r.packageName}: ${r.description}`)
    }
  }
  if (result.archivedPackages.length > 0) {
    ui.logger.warning(`Archived repositories: ${result.archivedPackages.join(', ')}`)
  }

  const hasIssues =
    result.errors.length > 0 ||
    result.regressions.length > 0 ||
    result.archivedPackages.length > 0
  process.exit(hasIssues ? 1 : 0)
}

async function runBuild(): Promise<void> {
  const action = ui.logger.action(`Building db.json`).displayDuration()
  try {
    await build()
    action.succeeded(`Built db.json`)
    ui.logger.success(`Build completed`)
  } catch (err) {
    action.failed('build', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main().catch((err) => {
  ui.logger.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
