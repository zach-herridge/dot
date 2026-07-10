import type { Command } from 'commander';
import { c, table } from '../lib/ui.js';
import {
  monitorCr,
  fetchCr,
  getLatestRevision,
  extractAutoSdeFindings,
  printAutoSdeFindings,
  parseLocation,
  type AnalyzerInfo,
} from '../domain/cr-monitor.js';

/**
 * zh cr -- inspect and monitor Code Reviews.
 *
 * Usage:
 *   zh cr CR-272275220                  Show status + comments (latest revision)
 *   zh cr status CR-272275220 --rev 8   Show specific revision
 *   zh cr findings CR-272275220         AutoSDE findings only (structured)
 *   zh cr findings CR-272275220 --json  AutoSDE findings as JSON
 *   zh cr watch CR-272275220            Poll until analyzers finish
 */
export function registerCrCommand(program: Command): void {
  const cr = program
    .command('cr')
    .description('Inspect or monitor a Code Review');

  cr.command('status')
    .argument('<cr-id>', 'CR identifier (e.g. CR-272275220)')
    .description('Show analyzer status and comments')
    .option('-r, --rev <n>', 'Revision number (default: latest)')
    .action(async (crId: string, options: { rev?: string }) => {
      const rev = options.rev ? parseInt(options.rev, 10) : undefined;
      await showCrStatus(crId, rev);
    });

  cr.command('findings')
    .argument('<cr-id>', 'CR identifier')
    .description('Show AutoSDE findings only (structured for fix loops)')
    .option('-r, --rev <n>', 'Revision number (default: latest)')
    .option('-j, --json', 'Output as JSON for programmatic consumption')
    .action(async (crId: string, options: { rev?: string; json?: boolean }) => {
      const rev = options.rev ? parseInt(options.rev, 10) : undefined;
      await showFindings(crId, rev, options.json ?? false);
    });

  cr.command('watch')
    .argument('<cr-id>', 'CR identifier')
    .description('Poll analyzers until Dry Run Build and AutoSDE finish, then show findings')
    .action(async (crId: string) => {
      await monitorCr(crId, { plain: true, showFindings: true });
    });

  // Default: "zh cr CR-272275220" shows status
  cr.argument('<cr-id>', 'CR identifier')
    .action(async (crId: string) => {
      await showCrStatus(crId);
    });
}

async function showFindings(crId: string, revision?: number, json?: boolean): Promise<void> {
  const rev = revision ?? (await getLatestRevision(crId));
  if (!revision) {
    console.error(c.dim(`Fetching revision ${rev}...`));
  }

  const data = await fetchCr(crId, rev);
  if (!data) {
    console.error(c.err(`Failed to fetch ${crId} rev ${rev} (run mwinit if Midway expired)`));
    process.exit(1);
  }

  const findings = extractAutoSdeFindings(data);

  if (json) {
    const output = {
      crId,
      revision: rev,
      totalFindings: findings.length,
      activeFindings: findings.filter((f) => !f.fixed).length,
      resolvedFindings: findings.filter((f) => f.fixed).length,
      findings: findings.map((f) => ({
        file: f.file,
        line: f.line,
        fixed: f.fixed,
        content: f.content,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    if (findings.filter((f) => !f.fixed).length > 0) process.exit(1);
    return;
  }

  console.log(c.bold(`${crId} revision ${rev}`));
  console.log();
  printAutoSdeFindings(findings);

  if (findings.filter((f) => !f.fixed).length > 0) {
    process.exit(1);
  }
}

async function showCrStatus(crId: string, revision?: number): Promise<void> {
  const rev = revision ?? (await getLatestRevision(crId));
  if (!revision) {
    console.error(c.dim(`Fetching latest revision (${rev})...`));
  }

  const data = await fetchCr(crId, rev);
  if (!data) {
    console.error(c.err(`Failed to fetch ${crId} rev ${rev} (run mwinit if Midway expired)`));
    process.exit(1);
  }

  // --- Header ---
  console.log(c.bold(`${crId} revision ${rev}`));
  console.log();

  // --- Analyzers ---
  if (data.analyzers && data.analyzers.length > 0) {
    console.log(c.bold('Analyzers'));
    const rows: string[][] = [];
    for (const a of data.analyzers) {
      const eff = getEffectiveStatus(a);
      const icon = eff === 'Pass' ? c.ok('✓')
        : eff === 'Fail' ? c.err('✗')
        : eff === 'Working' ? c.warn('○')
        : c.dim('○');
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
      const fixedLabel = cm.fixed ? c.ok(' [resolved]') : '';
      const rawLoc = cm.location?.comment_location?.location ?? '';
      const { file, line } = parseLocation(rawLoc);

      console.log();
      console.log(`  ${c.bold(author)}${fixedLabel} ${file ? `${c.dim(file)}${line ? `:${line}` : ''}` : ''}`);

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
