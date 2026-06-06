import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ky from "ky";
import { Octokit } from "@octokit/rest";

export const FETCH_DELAY = 100;

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const packagesDir = resolve(rootDir, "packages");
export const iconsDir = resolve(rootDir, "icons");
export const distFile = resolve(rootDir, "db.json");

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const http = ky.create({
  timeout: 15_000,
  retry: 1,
});

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface GithubPkg {
  name: string;
  description?: string;
  version?: string;
}

function parseRepo(repo: string): { owner: string; name: string; ref: string } {
  const [ownerRepo, ref = "HEAD"] = repo.split("#");
  const [owner, name] = ownerRepo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo: ${repo}`);
  return { owner, name, ref };
}

export async function fetchGithubPkg(repo: string): Promise<GithubPkg> {
  const { owner, name, ref } = parseRepo(repo);
  const url = `https://raw.githubusercontent.com/${owner}/${name}/${ref}/package.json`;
  return await http.get(url).json<GithubPkg>();
}

/**
 * Returns the canonical `owner/name` if the repo was renamed/moved,
 * or `null` if it's already canonical.
 */
export async function checkGithubRepoRedirect(repo: string): Promise<string | null> {
  const { owner, name } = parseRepo(repo);
  try {
    const res = await octokit.repos.get({ owner, repo: name });
    const finalOwner = res.data.owner.login;
    const finalName = res.data.name;
    const canonical = `${finalOwner}/${finalName}`;
    return canonical === `${owner}/${name}` ? null : canonical;
  } catch {
    return null;
  }
}

export async function isRepoArchived(repo: string): Promise<boolean> {
  const { owner, name } = parseRepo(repo);
  try {
    const res = await octokit.repos.get({ owner, repo: name });
    return res.data.archived ?? false;
  } catch {
    return false;
  }
}

/**
 * Returns the final URL after redirects if it differs from the input,
 * or `null` if the URL is already canonical / unreachable.
 */
export async function checkWebsiteRedirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok) return null;
    return res.url !== url ? res.url : null;
  } catch {
    return null;
  }
}
