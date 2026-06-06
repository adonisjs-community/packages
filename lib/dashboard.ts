import type { DashboardItem, DashboardItemCategory, AutoUpdate } from "./healthcheck.ts";

const HEADER_MARKER = "<!-- @adonisjs-bot:dashboard:v1 -->";

const SECTION_TITLES: Record<DashboardItemCategory, string> = {
  "compat-bump": "Compatibility bumps",
  "new-major": "New AdonisJS major support",
  stale: "Status changes",
};

const SECTION_ORDER: DashboardItemCategory[] = ["compat-bump", "new-major", "stale"];

export interface RenderInput {
  items: DashboardItem[];
  autoUpdates: AutoUpdate[];
  generatedAt: Date;
  runUrl?: string;
}

export function renderDashboardBody(input: RenderInput): string {
  const lines: string[] = [];
  lines.push(HEADER_MARKER, "", "# Healthiness Dashboard", "");
  lines.push(
    "Tick a box to open a PR for that change. Untick to abandon (the bot will not close the PR — do that yourself).",
    "",
    "⚠️ Do not hand-edit anything else in this body — the bot rewrites it weekly.",
    "",
  );

  for (const cat of SECTION_ORDER) {
    const inCat = input.items.filter((i) => i.category === cat);
    if (inCat.length === 0) continue;
    lines.push(`## ${SECTION_TITLES[cat]}`);
    for (const item of inCat) {
      lines.push(`- [ ] ${item.title} <!-- id:${item.id} -->`);
    }
    lines.push("");
  }

  // FYI section: last 10 changes only, to keep the body compact
  const fyi = input.autoUpdates.slice(0, 10);
  if (fyi.length > 0) {
    lines.push("## Recently auto-updated (FYI)");
    for (const u of fyi) {
      const bits: string[] = [];
      if (u.patch.lastCommitAt) bits.push(`lastCommitAt → ${u.patch.lastCommitAt.slice(0, 10)}`);
      if (u.patch.status) bits.push(`status → ${u.patch.status}`);
      if (bits.length > 0) lines.push(`- \`${u.name}\`: ${bits.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    `*Last run: ${input.generatedAt.toISOString()}${input.runUrl ? ` ([log](${input.runUrl}))` : ""}*`,
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Diff old vs new body, return ids of items that flipped from `[ ]` → `[x]`.
 */
export function findNewlyTickedIds(oldBody: string, newBody: string): string[] {
  const oldChecked = extractTickedIds(oldBody);
  const newChecked = extractTickedIds(newBody);
  return newChecked.filter((id) => !oldChecked.includes(id));
}

function extractTickedIds(body: string): string[] {
  const ids: string[] = [];
  const re = /^- \[x\] .*<!-- id:([^\s>]+) -->/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}
