import type { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { c, table, confirm } from '../lib/ui.js';
import { monitorCr, fetchCr, getLastCr, type AnalyzerInfo } from '../domain/cr-monitor.js';
import { Workspace } from '../domain/workspace.js';
import type { Package } from '../domain/package.js';

/**
 * zh cr -- inspect and monitor Code Reviews.
 *
 * Usage:
 *   zh cr CR-272275220         Show status + comments
 *   zh cr watch CR-272275220   Poll until analyzers finish
 *   zh cr fix CR-272275220     Draft fixes for the comments with Claude
 */
export function registerCrCommand(program: Command): void {
  const cr = program
    .command('cr')
    .description('Inspect or monitor a Code Review');

  cr.command('status')
    .argument('<cr-id>', 'CR identifier (e.g. CR-272275220)')
    .description('Show analyzer status and comments')
    .action(async (crId: string) => {
      await showCrStatus(crId);
    });

  cr.command('watch')
    .argument('[cr-id]', 'CR identifier (defaults to last CR from zh prep)')
    .description('Poll analyzers until Dry Run Build and AutoSDE finish')
    .option('-y, --yes', 'Plain output (no ANSI cursor movement)')
    .action(async (crId: string | undefined, options: { yes?: boolean }) => {
      const resolved = crId || getLastCr();
      if (!resolved) {
        console.log(c.dim('No CR specified and no previous CR found. Run zh prep first.'));
        process.exit(1);
      }
      if (!crId) console.log(c.dim(`(watching last CR: ${resolved})`));
      await monitorCr(resolved, { plain: !!options.yes });
    });

  cr.command('fix')
    .argument('[cr-id]', 'CR identifier (defaults to last CR from zh prep)')
    .description('Draft fixes for the CR comments with Claude, grouped by package')
    .option('-n, --dry-run', 'Show the plan (comments grouped by package), then stop')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('--apply', 'Let Claude edit files in place (default: draft suggestions only)')
    .action(
      async (
        crId: string | undefined,
        options: { dryRun?: boolean; yes?: boolean; apply?: boolean },
      ) => {
        const resolved = crId || getLastCr();
        if (!resolved) {
          console.log(c.dim('No CR specified and no previous CR found. Run zh prep first.'));
          process.exit(1);
        }
        if (!crId) console.log(c.dim(`(using last CR: ${resolved})`));
        await fixCr(resolved, options);
      },
    );

  // Default action: "zh cr CR-272275220" shows status, "zh cr" shows last
  cr.argument('[cr-id]', 'CR identifier (defaults to last CR from zh prep)')
    .action(async (crId?: string) => {
      const resolved = crId || getLastCr();
      if (!resolved) {
        console.log(c.dim('No CR specified and no previous CR found. Run zh prep first.'));
        process.exit(1);
      }
      if (!crId) {
        console.log(c.dim(`(using last CR: ${resolved})`));
        console.log();
      }
      await showCrStatus(resolved);
    });
}

async function showCrStatus(crId: string): Promise<void> {
  const data = await fetchCr(crId);
  if (!data) {
    console.log(c.err(`Failed to fetch ${crId} (check mwinit / midway cookie)`));
    process.exit(1);
  }

  // --- Analyzers ---
  console.log(c.bold(`${crId}`));
  console.log();

  if (data.analyzers && data.analyzers.length > 0) {
    console.log(c.bold('Analyzers'));
    const rows: string[][] = [];
    for (const a of data.analyzers) {
      const eff = getEffectiveStatus(a);
      const icon = eff === 'Pass' ? c.ok('\u2713')
        : eff === 'Fail' ? c.err('\u2717')
        : eff === 'Working' ? c.warn('\u25cb')
        : c.dim('\u25cb');
      const cnt = commentCount(a);
      const label = cnt > 0 ? `Fail (${cnt} comments)` : a.status;
      const status = eff === 'Pass' ? c.ok(label)
        : eff === 'Fail' ? c.err(label)
        : eff === 'Working' ? c.warn(label)
        : c.dim(label);
      rows.push([icon, a.partner_id, status]);
    }
    table(rows);
  }

  // --- Comments ---
  const comments = data.revision?.cr_revision?.comments;
  if (comments && comments.length > 0) {
    console.log();
    console.log(c.bold(`Comments (${comments.length})`));
    for (const comment of comments) {
      const cm = comment.cr_comment;
      if (!cm) continue;
      const author = cm.author?.entity_id?.id ?? 'unknown';
      const loc = cm.location?.comment_location?.location ?? '';
      // Parse location to extract file and line
      const locParts = loc.split('::');
      const file = locParts[1] ?? '';
      const line = locParts[2] ?? '';

      console.log();
      console.log(`  ${c.bold(author)} ${file ? `${c.dim(file)}${line ? `:${line}` : ''}` : ''}`);

      // Show content (truncate long comments for terminal readability)
      const content = cm.content ?? '';
      const lines = content.split('\n');
      const maxLines = 20;
      const display = lines.slice(0, maxLines);
      for (const l of display) {
        console.log(`  ${l}`);
      }
      if (lines.length > maxLines) {
        console.log(`  ${c.dim(`... (${lines.length - maxLines} more lines)`)}`);
      }
    }
  } else {
    console.log();
    console.log(c.dim('No comments'));
  }
}

// ── zh cr fix ────────────────────────────────────────────────────────────────

interface ParsedComment {
  file: string; // path as it appears in the CR (may be package-prefixed)
  line: string;
  author: string;
  content: string;
}

/** Pull the comment list out of a CR revision into a flat, typed shape. */
function parseComments(data: NonNullable<Awaited<ReturnType<typeof fetchCr>>>): ParsedComment[] {
  const raw = data.revision?.cr_revision?.comments ?? [];
  const out: ParsedComment[] = [];
  for (const comment of raw) {
    const cm = comment.cr_comment;
    if (!cm) continue;
    if (cm.fixed) continue; // already addressed
    const loc = cm.location?.comment_location?.location ?? '';
    const parts = loc.split('::');
    out.push({
      file: parts[1] ?? '',
      line: parts[2] ?? '',
      author: cm.author?.entity_id?.id ?? 'unknown',
      content: (cm.content ?? '').trim(),
    });
  }
  return out;
}

/**
 * Resolve which workspace package owns a comment's file. CR locations may be
 * package-prefixed (PackageName/src/...) or repo-relative, so rather than guess
 * the format we test which package directory actually contains the file. Returns
 * the package plus the file path RELATIVE to that package (for Claude's cwd).
 */
function resolvePackage(
  file: string,
  packages: Package[],
): { pkg: Package; relPath: string } | null {
  if (!file) return null;
  for (const pkg of packages) {
    // Case 1: location is "<PackageName>/<rest>".
    if (file.startsWith(pkg.name + '/')) {
      const rel = file.slice(pkg.name.length + 1);
      if (existsSync(join(pkg.path, rel))) return { pkg, relPath: rel };
    }
    // Case 2: location is already package-relative.
    if (existsSync(join(pkg.path, file))) return { pkg, relPath: file };
  }
  return null;
}

function buildFixPrompt(
  comments: { relPath: string; line: string; author: string; content: string }[],
  apply: boolean,
): string {
  const items = comments
    .map(
      (c, i) =>
        `${i + 1}. ${c.relPath}${c.line ? `:${c.line}` : ''} (from ${c.author})\n   ${c.content.replace(/\n/g, '\n   ')}`,
    )
    .join('\n\n');

  const action = apply
    ? `For each comment, read the referenced file, decide the correct fix, and APPLY it by editing the file. After making the edits, print a one-line summary per comment of what you changed (or why you intentionally skipped it).`
    : `For each comment, read the referenced file and propose a concrete fix as a unified diff or a short code snippet. Do NOT edit any files — only suggest. Keep each suggestion tight and actionable.`;

  return `You are addressing code-review comments on a single package. The working directory is the package root, so all paths below are relative to it.

${action}

Be conservative: only change what the comment asks for. If a comment is a question or a non-actionable nit, say so briefly instead of inventing a change.

Comments to address:

${items}`;
}

/**
 * zh cr fix -- fetch a CR's comments, group them by package, and run Claude on
 * each package (in its own directory) to draft or apply fixes. Every building
 * block already exists: fetchCr (data), parseComments (parse), resolvePackage
 * (mapping), and the prep.ts Claude-spawn pattern. This just wires them up.
 */
async function fixCr(
  crId: string,
  options: { dryRun?: boolean; yes?: boolean; apply?: boolean },
): Promise<void> {
  const data = await fetchCr(crId);
  if (!data) {
    console.log(c.err(`Failed to fetch ${crId} (check mwinit / midway cookie)`));
    process.exit(1);
  }

  const comments = parseComments(data);
  if (comments.length === 0) {
    console.log(c.dim('No open comments to fix.'));
    return;
  }

  const ws = Workspace.discover();
  if (!ws) {
    console.error(c.err('No workspace found (run from inside a Brazil workspace)'));
    process.exit(1);
  }
  const packages = await ws.packages();

  // Group comments by owning package; collect anything we can't place.
  const byPackage = new Map<string, { pkg: Package; items: typeof comments }>();
  const unresolved: ParsedComment[] = [];
  for (const comment of comments) {
    const resolved = resolvePackage(comment.file, packages);
    if (!resolved) {
      unresolved.push(comment);
      continue;
    }
    const entry = byPackage.get(resolved.pkg.name) ?? { pkg: resolved.pkg, items: [] };
    // Store the package-relative path so Claude (running in the pkg dir) finds it.
    entry.items.push({ ...comment, file: resolved.relPath });
    byPackage.set(resolved.pkg.name, entry);
  }

  // --- Show the plan ---
  console.log(c.bold(`${crId} — ${comments.length} comment(s) across ${byPackage.size} package(s)`));
  console.log();
  for (const { pkg, items } of byPackage.values()) {
    console.log(c.pkg(pkg.name));
    for (const item of items) {
      const head = item.content.split('\n')[0].slice(0, 80);
      console.log(`  ${c.dim(`${item.file}${item.line ? `:${item.line}` : ''}`)}  ${head}`);
    }
  }
  if (unresolved.length > 0) {
    console.log();
    console.log(c.warn(`${unresolved.length} comment(s) could not be mapped to a package (skipped):`));
    for (const u of unresolved) {
      console.log(`  ${c.dim(u.file || '(no file)')}  ${u.content.split('\n')[0].slice(0, 80)}`);
    }
  }

  if (options.dryRun) {
    console.log(c.dim('\nDry run — no Claude calls made.'));
    return;
  }
  if (byPackage.size === 0) {
    console.log(c.dim('\nNothing actionable to fix.'));
    return;
  }

  const mode = options.apply ? c.err('APPLY (edits files in place)') : 'draft suggestions';
  console.log();
  console.log(`Claude will run once per package in ${mode}.`);
  if (!options.yes) {
    const ok = await confirm('Proceed?', !options.apply); // default No when applying edits
    if (!ok) {
      console.log(c.dim('Aborted.'));
      return;
    }
  }

  // --- Run Claude per package, in parallel (mirrors prep.ts) ---
  console.log();
  const results = await Promise.allSettled(
    [...byPackage.values()].map(async ({ pkg, items }) => {
      const prompt = buildFixPrompt(
        items.map((i) => ({ relPath: i.file, line: i.line, author: i.author, content: i.content })),
        !!options.apply,
      );
      const args = ['-p', '--output-format', 'text', '--model', 'sonnet'];
      if (options.apply) {
        args.push('--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Edit', 'Write', 'Grep', 'Glob');
      } else {
        args.push('--tools', ''); // suggestion-only: no tool access
      }
      const proc = Bun.spawn(['claude', ...args], {
        cwd: pkg.path,
        stdin: new Blob([prompt]),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      return { pkg, output: output.trim(), exitCode };
    }),
  );

  for (const r of results) {
    console.log();
    if (r.status === 'rejected') {
      console.log(c.err(`  (a package fix failed: ${r.reason})`));
      continue;
    }
    const { pkg, output, exitCode } = r.value;
    console.log(c.pkg(pkg.name) + (exitCode !== 0 ? c.err(`  (claude exit ${exitCode})`) : ''));
    console.log(output || c.dim('  (no output)'));
  }

  console.log();
  if (options.apply) {
    console.log(c.warn('Review the edits with `zh status` / git diff before amending your CR.'));
  } else {
    console.log(c.dim('Suggestions only — no files changed. Re-run with --apply to let Claude edit.'));
  }
}

function commentCount(info: AnalyzerInfo): number {
  if (info.partner_id !== 'AutoSDE - CR reviewer') return 0;
  if (!info.status_message) return 0;
  const match = info.status_message.match(/(\d+) comment/);
  return match ? parseInt(match[1], 10) : 0;
}

function hasComments(info: AnalyzerInfo): boolean {
  return commentCount(info) > 0;
}

function getEffectiveStatus(info: AnalyzerInfo): string {
  if (hasComments(info)) return 'Fail';
  return info.status;
}
