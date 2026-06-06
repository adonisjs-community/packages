import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globby } from "globby";
import pLimit from "p-limit";
import semver from "semver";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { categories } from "./categories.ts";
import {
  FETCH_DELAY,
  checkGithubRepoRedirect,
  checkWebsiteRedirect,
  fetchGithubPkg,
  iconsDir,
  isRepoArchived,
  packagesDir,
  sleep,
} from "./utils.ts";
import type {
  PackageInfo,
  SyncAllResult,
  SyncError,
  SyncProgressCallback,
  SyncRegression,
  SyncResult,
} from "./types.ts";

async function loadPackage(name: string): Promise<PackageInfo> {
  const file = resolve(packagesDir, `${name}.yml`);
  if (!existsSync(file)) {
    throw new Error(`Package ${name} not found at ${file}`);
  }
  const raw = await readFile(file, "utf-8");
  return parseYaml(raw) as PackageInfo;
}

async function writePackage(pkg: PackageInfo): Promise<void> {
  const file = resolve(packagesDir, `${pkg.name}.yml`);
  await writeFile(file, stringifyYaml(pkg, { sortMapEntries: true }), "utf-8");
}

export async function sync(name: string, repo?: string, isNew = false): Promise<SyncResult> {
  const pkg = await loadPackage(name);
  const regressions: SyncRegression[] = [];
  const originalCompatMajors = Object.keys(pkg.compatibility?.adonis ?? {});

  // 1. repo
  if (repo) pkg.repo = repo;
  if (!pkg.repo) throw new Error(`repo not provided for ${name}`);

  // 2. repo redirect
  try {
    const newRepo = await checkGithubRepoRedirect(pkg.repo);
    if (newRepo) {
      const hashIndex = pkg.repo.indexOf("#");
      const suffix = hashIndex !== -1 ? pkg.repo.slice(hashIndex) : "";
      regressions.push({
        type: "repo-redirect",
        packageName: name,
        description: `Repo redirected from ${pkg.repo} to ${newRepo}${suffix}`,
      });
      pkg.repo = newRepo + suffix;
    }
  } catch (err) {
    console.warn(`Could not check repo redirect for ${pkg.repo}:`, err);
  }

  // 3. derive github url
  pkg.github = `https://github.com/${pkg.repo.split("#")[0]}`;

  await sleep(FETCH_DELAY);

  // 4. package.json
  const ghPkg = await fetchGithubPkg(pkg.repo);
  pkg.npm = ghPkg.name;
  if (ghPkg.description) pkg.description = ghPkg.description;

  // 5. type
  pkg.type = pkg.repo.startsWith("adonisjs/") ? "official" : "3rd-party";

  // 6. category (hard error)
  if (!pkg.category) {
    throw new Error(`No category set for ${name}`);
  }
  if (!categories.includes(pkg.category)) {
    throw new Error(
      `Invalid category "${pkg.category}" for ${name}. Allowed: ${categories.join(", ")}`,
    );
  }

  // 7. icon (hard error if specified but missing)
  if (pkg.icon) {
    const iconPath = resolve(iconsDir, pkg.icon);
    if (!existsSync(iconPath)) {
      throw new Error(`Icon ${pkg.icon} not found in /icons/ for ${name}`);
    }
  }

  // 8. website
  if (pkg.website) {
    try {
      const redirected = await checkWebsiteRedirect(pkg.website);
      if (redirected) {
        regressions.push({
          type: "website",
          packageName: name,
          description: `Website redirected from ${pkg.website} to ${redirected}`,
        });
        pkg.website = redirected;
      }
    } catch (err) {
      console.warn(`Could not check website redirect for ${pkg.website}:`, err);
    }
  } else {
    pkg.website = pkg.github;
  }

  await sleep(FETCH_DELAY);

  // 9. compatibility (hard error)
  if (!pkg.compatibility?.adonis || Object.keys(pkg.compatibility.adonis).length === 0) {
    throw new Error(`Missing compatibility.adonis for ${name}`);
  }
  for (const [major, range] of Object.entries(pkg.compatibility.adonis)) {
    if (!/^\d+$/.test(major)) {
      throw new Error(`Invalid major version "${major}" for ${name}`);
    }
    if (!semver.validRange(range)) {
      throw new Error(`Invalid semver range "${range}" for ${name} (major ${major})`);
    }
  }

  // 10. maintainers (only fill if empty)
  if (!pkg.maintainers || pkg.maintainers.length === 0) {
    const owner = pkg.repo.split("/")[0]!;
    if (owner === "adonisjs") {
      if (!isNew) throw new Error(`No maintainer for ${name}`);
    } else {
      pkg.maintainers = [{ name: owner, github: owner }];
    }
  }

  // 11. archived
  pkg.archived = await isRepoArchived(pkg.repo);

  // 12. regressions — dropped compatibility majors
  const currentCompatMajors = Object.keys(pkg.compatibility.adonis);
  const droppedMajors = originalCompatMajors.filter((m) => !currentCompatMajors.includes(m));
  for (const major of droppedMajors) {
    regressions.push({
      type: "compatibility",
      packageName: name,
      description: `Dropped support for AdonisJS v${major}`,
    });
  }

  // 13. write yml back (sorted keys → stable diff)
  await writePackage(pkg);

  return { package: pkg, regressions };
}

export async function syncAll(onProgress?: SyncProgressCallback): Promise<SyncAllResult> {
  const files = await globby("*.yml", { cwd: packagesDir });
  const names = files.map((f) => f.replace(/\.yml$/, ""));
  const limit = pLimit(10);
  const synced: string[] = [];
  const errors: SyncError[] = [];
  const regressions: SyncRegression[] = [];
  const archivedPackages: string[] = [];
  let current = 0;

  await Promise.all(
    names.map((name) =>
      limit(async () => {
        try {
          const result = await sync(name);
          synced.push(name);
          regressions.push(...result.regressions);
          if (result.package.archived) archivedPackages.push(name);
        } catch (err) {
          errors.push({ packageName: name, error: err as Error });
        }
        current++;
        onProgress?.(current, names.length, name);
      }),
    ),
  );

  return {
    total: names.length,
    synced,
    errors,
    regressions,
    archivedPackages,
  };
}
