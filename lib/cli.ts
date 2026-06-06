import process from "node:process";
import { cliui } from "@poppinss/cliui";
import { build } from "./build.ts";
import { renderDashboardBody, findNewlyTickedIds } from "./dashboard.ts";
import { applyAutoUpdates, applyDashboardItem, healthcheck } from "./healthcheck.ts";
import { sync, syncAll } from "./sync.ts";

const ui = cliui();

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "sync":
      await runSync(args);
      break;
    case "build":
      await runBuild();
      break;
    case "healthcheck":
      await runHealthcheck(args);
      break;
    case "dashboard-diff":
      await runDashboardDiff();
      break;
    default:
      ui.logger.error(`Unknown command: ${command ?? "(none)"}`);
      ui.logger.info("Usage: cli.ts <sync|build|healthcheck|dashboard-diff> [args]");
      process.exit(1);
  }
}

async function runSync(args: string[]): Promise<void> {
  const [name, repo] = args;
  if (name) {
    await runSingleSync(name, repo);
  } else {
    await runSyncAll();
  }
}

async function runSingleSync(name: string, repo?: string): Promise<void> {
  const action = ui.logger.action(`Syncing ${name}`).displayDuration();
  try {
    const { package: pkg, regressions } = await sync(name, repo, true);
    action.succeeded();

    if (regressions.length > 0) {
      ui.logger.warning(`Regressions detected (${regressions.length}):`);
      for (const r of regressions) {
        ui.logger.warning(`  [${r.type}] ${r.description}`);
      }
    }
    if (pkg.status === "archived") {
      ui.logger.error(`Repository is archived`);
      process.exit(1);
    }
    ui.logger.success(`Sync completed successfully`);
  } catch (err) {
    action.failed(`name : ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function runSyncAll(): Promise<void> {
  const result = await syncAll((current, total, name) => {
    ui.logger.info(`[${current}/${total}] ${name}`);
  });
  ui.logger.success(`Synced ${result.synced.length}/${result.total} packages`);

  if (result.errors.length > 0) {
    ui.logger.error(`Failed to sync ${result.errors.length} package(s):`);
    for (const e of result.errors) {
      ui.logger.error(`  ${e.packageName}: ${e.error.message}`);
    }
  }
  if (result.regressions.length > 0) {
    ui.logger.warning(`Regressions detected (${result.regressions.length}):`);
    for (const r of result.regressions) {
      ui.logger.warning(`  [${r.type}] ${r.packageName}: ${r.description}`);
    }
  }
  if (result.archivedPackages.length > 0) {
    ui.logger.warning(`Archived repositories: ${result.archivedPackages.join(", ")}`);
  }

  const hasIssues =
    result.errors.length > 0 || result.regressions.length > 0 || result.archivedPackages.length > 0;
  process.exit(hasIssues ? 1 : 0);
}

async function runBuild(): Promise<void> {
  const action = ui.logger.action(`Building db.json`).displayDuration();
  try {
    await build();
    action.succeeded();
    ui.logger.success(`Build completed`);
  } catch (err) {
    action.failed(`build ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function runHealthcheck(args: string[]): Promise<void> {
  const apply = args.includes("--apply");
  const emitItems = args.includes("--emit-items");
  const applyItemIdx = args.indexOf("--apply-item");
  const itemTitleIdx = args.indexOf("--item-title");

  const result = await healthcheck();

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      ui.logger.warning(`[${e.packageName}] ${e.error.message}`);
    }
  }

  if (applyItemIdx !== -1) {
    const id = args[applyItemIdx + 1];
    if (!id) {
      ui.logger.error("--apply-item requires an id");
      process.exit(1);
    }
    const item = result.dashboardItems.find((i) => i.id === id);
    if (!item) {
      ui.logger.error(`Dashboard item ${id} not found in current run`);
      process.exit(1);
    }
    await applyDashboardItem(item);
    ui.logger.success(`Applied ${id}`);
    return;
  }

  if (itemTitleIdx !== -1) {
    const id = args[itemTitleIdx + 1];
    if (!id) {
      ui.logger.error("--item-title requires an id");
      process.exit(1);
    }
    const item = result.dashboardItems.find((i) => i.id === id);
    if (!item) {
      ui.logger.error(`Dashboard item ${id} not found in current run`);
      process.exit(1);
    }
    process.stdout.write(stripMarkdownTitle(item.title) + "\n");
    return;
  }

  if (emitItems) {
    process.stdout.write(JSON.stringify(result.dashboardItems, null, 2) + "\n");
    return;
  }

  if (apply) {
    await applyAutoUpdates(result.autoUpdates);
    const body = renderDashboardBody({
      items: result.dashboardItems,
      autoUpdates: result.autoUpdates,
      generatedAt: new Date(),
      runUrl: process.env.GITHUB_RUN_URL,
    });
    process.stdout.write(body);
    return;
  }

  // Dry-run summary
  ui.logger.info(`Auto-updates would touch ${result.autoUpdates.length} package(s)`);
  ui.logger.info(`Dashboard items proposed: ${result.dashboardItems.length}`);
  for (const item of result.dashboardItems) {
    ui.logger.info(`  [${item.category}] ${stripMarkdownTitle(item.title)}`);
  }
}

function stripMarkdownTitle(title: string): string {
  // Remove markdown backticks for plain text contexts (PR titles, commit messages).
  return title.replace(/`/g, "");
}

async function runDashboardDiff(): Promise<void> {
  const oldBody = process.env.OLD_BODY ?? "";
  const newBody = process.env.NEW_BODY ?? "";
  if (!newBody) {
    ui.logger.error("dashboard-diff requires NEW_BODY env var");
    process.exit(1);
  }
  const ids = findNewlyTickedIds(oldBody, newBody);
  for (const id of ids) {
    process.stdout.write(id + "\n");
  }
}

main().catch((err) => {
  ui.logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
