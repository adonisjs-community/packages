import type { Category } from "./categories.ts";

export interface Maintainer {
  name: string;
  github: string;
  twitter?: string;
  bluesky?: string;
}

export interface PackageCompatibility {
  adonis: Record<string, string>;
}

export type PackageType = "official" | "3rd-party";

export type PackageStatus = "healthy" | "stale" | "archived";

export interface PackageInfo {
  name: string;
  description: string;
  repo: string;
  npm: string;
  icon?: string;
  github: string;
  website: string;
  category: Category;
  type: PackageType;
  maintainers: Maintainer[];
  compatibility: PackageCompatibility;
  aliases?: string[];

  // Bot-owned fields (optional until first cron run fills them):
  lastCommitAt?: string;
  lastReleaseAt?: string;
  latestNpmVersion?: string;
  status?: PackageStatus;
}

export type RegressionType = "compatibility" | "website" | "repo-redirect";

export interface SyncRegression {
  type: RegressionType;
  packageName: string;
  description: string;
}

export interface SyncResult {
  package: PackageInfo;
  regressions: SyncRegression[];
}

export interface SyncError {
  packageName: string;
  error: Error;
}

export interface SyncAllResult {
  total: number;
  synced: string[];
  errors: SyncError[];
  regressions: SyncRegression[];
  archivedPackages: string[];
}

export type SyncProgressCallback = (current: number, total: number, packageName: string) => void;

export interface BuildOutput {
  generatedAt: string;
  version: string;
  categories: readonly string[];
  packages: PackageInfo[];
}
