import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globby } from "globby";
import pLimit from "p-limit";
import semver from "semver";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { STALE_MONTHS, monthsBetween } from "./health-thresholds.ts";
import {
  fetchNpmPackage,
  getCurrentAdonisMajor,
  getLastCommitDate,
  isRepoArchived,
  packagesDir,
} from "./utils.ts";
import type { PackageInfo, PackageStatus } from "./types.ts";

export interface PackageHealthData {
  newLastCommitAt: string | null;
  newLastReleaseAt: string | null;
  newLatestNpmVersion: string | null;
  ghArchived: boolean;
}

export interface AutoUpdate {
  name: string;
  patch: Partial<PackageInfo>;
}

export type DashboardItemCategory = "compat-bump" | "new-major" | "stale";

export interface DashboardItem {
  id: string;
  packageName: string;
  category: DashboardItemCategory;
  title: string;
  yamlPatch: Partial<PackageInfo>;
}

export interface HealthcheckError {
  packageName: string;
  error: Error;
}

export interface HealthcheckResult {
  autoUpdates: AutoUpdate[];
  dashboardItems: DashboardItem[];
  errors: HealthcheckError[];
}

async function loadPackage(name: string): Promise<PackageInfo> {
  const file = resolve(packagesDir, `${name}.yml`);
  if (!existsSync(file)) throw new Error(`Package ${name} not found`);
  const raw = await readFile(file, "utf-8");
  return parseYaml(raw) as PackageInfo;
}

async function fetchHealthData(pkg: PackageInfo): Promise<PackageHealthData> {
  const [commitDate, ghArchived, npmInfo] = await Promise.all([
    getLastCommitDate(pkg.repo),
    isRepoArchived(pkg.repo),
    fetchNpmPackage(pkg.npm).catch(() => null),
  ]);
  return {
    newLastCommitAt: commitDate,
    newLastReleaseAt: npmInfo?.latestPublishedAt ?? null,
    newLatestNpmVersion: npmInfo?.latestVersion ?? null,
    ghArchived,
  };
}

function computeAutoPatch(pkg: PackageInfo, data: PackageHealthData): Partial<PackageInfo> {
  const autoStatus: PackageStatus = data.ghArchived ? "archived" : "healthy";
  // Preserve a manually-set 'stale' status — only override if archived or non-stale healthy.
  const currentStatus = pkg.status;
  const status = data.ghArchived ? "archived" : currentStatus === "stale" ? "stale" : autoStatus;

  return {
    lastCommitAt: data.newLastCommitAt ?? undefined,
    lastReleaseAt: data.newLastReleaseAt ?? undefined,
    latestNpmVersion: data.newLatestNpmVersion ?? undefined,
    status,
  };
}

function isStaleCandidate(
  pkg: PackageInfo,
  data: PackageHealthData,
  currentAdonisMajor: number,
): boolean {
  if (!data.newLastCommitAt) return false;
  const inactive = monthsBetween(new Date(data.newLastCommitAt), new Date()) > STALE_MONTHS;
  const claimsCurrent = String(currentAdonisMajor) in pkg.compatibility.adonis;
  return inactive && !claimsCurrent;
}

function computeDashboardItems(
  pkg: PackageInfo,
  data: PackageHealthData,
  currentAdonisMajor: number,
  isStale: boolean,
): DashboardItem[] {
  const items: DashboardItem[] = [];

  // a. compat bump — latest npm version no longer satisfies the highest-declared major's range
  if (data.newLatestNpmVersion) {
    const majors = Object.keys(pkg.compatibility.adonis)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => b - a);
    const highest = majors[0];
    if (highest !== undefined) {
      const declared = pkg.compatibility.adonis[String(highest)];
      if (declared && !semver.satisfies(data.newLatestNpmVersion, declared)) {
        const merged = `${declared} || ^${data.newLatestNpmVersion}`;
        items.push({
          id: `bump-${pkg.name}-adonis-${highest}-${data.newLatestNpmVersion}`,
          packageName: pkg.name,
          category: "compat-bump",
          title: `Bump \`${pkg.name}\` compat.adonis.${highest} to include \`^${data.newLatestNpmVersion}\``,
          yamlPatch: {
            compatibility: {
              adonis: { ...pkg.compatibility.adonis, [String(highest)]: merged },
            },
          },
        });
      }
    }
  }

  // b. new major — current AdonisJS major isn't declared and the package isn't archived/stale
  const claimsCurrent = String(currentAdonisMajor) in pkg.compatibility.adonis;
  if (!claimsCurrent && !data.ghArchived && !isStale) {
    const v = data.newLatestNpmVersion ?? "0.0.0";
    items.push({
      id: `new-major-${pkg.name}-${currentAdonisMajor}`,
      packageName: pkg.name,
      category: "new-major",
      title: `Add \`adonis ${currentAdonisMajor}\` compat to \`${pkg.name}\``,
      yamlPatch: {
        compatibility: {
          adonis: { ...pkg.compatibility.adonis, [String(currentAdonisMajor)]: `^${v}` },
        },
      },
    });
  }

  // c. stale — bot proposes, never auto-applies
  if (isStale && pkg.status !== "stale") {
    items.push({
      id: `stale-${pkg.name}`,
      packageName: pkg.name,
      category: "stale",
      title: `Mark \`${pkg.name}\` as \`status: stale\``,
      yamlPatch: { status: "stale" },
    });
  }

  return items;
}

export async function healthcheck(): Promise<HealthcheckResult> {
  const files = await globby("*.yml", { cwd: packagesDir });
  const names = files.map((f) => f.replace(/\.yml$/, ""));
  const limit = pLimit(10);

  const currentAdonisMajor = await getCurrentAdonisMajor();

  const autoUpdates: AutoUpdate[] = [];
  const dashboardItems: DashboardItem[] = [];
  const errors: HealthcheckError[] = [];

  await Promise.all(
    names.map((name) =>
      limit(async () => {
        try {
          const pkg = await loadPackage(name);
          const data = await fetchHealthData(pkg);
          const patch = computeAutoPatch(pkg, data);
          autoUpdates.push({ name, patch });

          const stale = isStaleCandidate(pkg, data, currentAdonisMajor);
          dashboardItems.push(...computeDashboardItems(pkg, data, currentAdonisMajor, stale));
        } catch (err) {
          errors.push({ packageName: name, error: err as Error });
        }
      }),
    ),
  );

  // Deterministic ordering for idempotent runs
  autoUpdates.sort((a, b) => a.name.localeCompare(b.name));
  dashboardItems.sort((a, b) => a.id.localeCompare(b.id));

  return { autoUpdates, dashboardItems, errors };
}

export async function applyAutoUpdates(updates: AutoUpdate[]): Promise<void> {
  for (const { name, patch } of updates) {
    const file = resolve(packagesDir, `${name}.yml`);
    const raw = await readFile(file, "utf-8");
    const pkg = parseYaml(raw) as PackageInfo & { archived?: boolean };
    Object.assign(pkg, patch);
    // Drop the obsolete `archived` field if present (migration).
    delete pkg.archived;
    await writeFile(file, stringifyYaml(pkg, { sortMapEntries: true }), "utf-8");
  }
}

export async function applyDashboardItem(item: DashboardItem): Promise<void> {
  const file = resolve(packagesDir, `${item.packageName}.yml`);
  const raw = await readFile(file, "utf-8");
  const pkg = parseYaml(raw) as PackageInfo;
  Object.assign(pkg, item.yamlPatch);
  await writeFile(file, stringifyYaml(pkg, { sortMapEntries: true }), "utf-8");
}
