import type { Command } from 'commander';
import { c, table } from '../lib/ui.js';
import { monitorCr, fetchCr, getLastCr, type AnalyzerInfo } from '../domain/cr-monitor.js';

/**
 * zh cr -- inspect and monitor Code Reviews.
 *
 * Usage:
 *   zh cr CR-272275220         Show status + comments
 *   zh cr watch CR-272275220   Poll until analyzers finish
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
