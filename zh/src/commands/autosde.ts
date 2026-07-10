import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import type { Package } from '../domain/package.js';
import { runAnalysis, printFindings } from '../domain/autosde.js';
import * as sessions from '../domain/autosde-sessions.js';
import { c, empty } from '../lib/ui.js';

/**
 * zh autosde -- submit diffs to AutoSDE for analysis.
 *
 * Session management is explicit — Claude must pass --session on re-runs.
 * First run (no --session) creates a new session.
 * This prevents accidentally mixing sessions across different work.
 *
 * Exit codes:
 *   0 — no findings
 *   1 — findings exist
 *   2 — tool/API error
 */
export function registerAutoSdeCommand(program: Command): void {
  program
    .command('autosde')
    .argument('<packages...>', 'Package names (fuzzy match)')
    .description('Run AutoSDE analysis on committed diffs (pre-CR)')
    .option('-s, --session <id>', 'Session ID from a previous run (required for re-submissions)')
    .option('-j, --json', 'Output findings as JSON (for programmatic consumption)')
    .action(async (packageArgs: string[], options: { session?: string; json?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      // Resolve packages
      const packages: Package[] = [];
      for (const query of packageArgs) {
        const matches = await ws.findPackage(query);
        if (matches.length === 0) {
          console.error(c.err(`No package matching '${query}'`));
          process.exit(1);
        }
        if (matches.length === 1) {
          packages.push(matches[0]);
        } else {
          const exact = matches.find((m) => m.name.toLowerCase() === query.toLowerCase());
          if (exact) {
            packages.push(exact);
          } else {
            console.error(c.err(`Ambiguous: ${matches.map((m) => m.name).join(', ')}`));
            process.exit(1);
          }
        }
      }

      // Refuse if dirty — AutoSDE only sees committed diffs
      for (const pkg of packages) {
        const status = await pkg.status();
        if (status.dirty) {
          console.error(c.err(`${pkg.name} has uncommitted changes. Commit first.`));
          process.exit(2);
        }
      }

      // Gather diffs (committed changes vs mainline)
      const diffs = await Promise.all(
        packages.map(async (pkg) => ({
          packageName: pkg.name,
          diff: await pkg.diff('origin/mainline'),
        })),
      );

      const nonEmpty = diffs.filter((d) => d.diff.trim().length > 0);
      if (nonEmpty.length === 0) {
        empty('No diff against origin/mainline. Nothing to analyze.');
        return;
      }

      // Submit and poll
      try {
        const result = await runAnalysis(nonEmpty, {
          plain: true,
          sessionId: options.session,
        });

        // Log this run
        const branch = await packages[0].currentBranch();
        sessions.log({
          sessionId: result.sessionId,
          runId: result.runId,
          workspace: ws.name,
          branch,
          packages: packages.map((p) => p.name),
          findings: result.totalFindings,
          blocking: result.totalBlocking,
          status: result.status,
        });

        // JSON mode: structured output for programmatic consumption
        if (options.json) {
          const output = {
            sessionId: result.sessionId,
            runId: result.runId,
            status: result.status,
            totalFindings: result.totalFindings,
            totalBlocking: result.totalBlocking,
            executionTimeMs: result.executionTimeMs,
            findings: result.packages.flatMap((pkg) =>
              pkg.findings.map((f) => ({
                package: pkg.name,
                file: f.to_path,
                line: f.line_number,
                blocking: f.blocking,
                category: f.category,
                text: f.comment_text,
              })),
            ),
          };
          console.log(JSON.stringify(output, null, 2));
          if (result.totalFindings > 0) process.exit(1);
          return;
        }

        // Print findings (human mode)
        printFindings(result);

        // Always print session + run — Claude needs session for next run and CR
        console.log();
        console.log(`session: ${result.sessionId}`);
        console.log(`run: ${result.runId}`);

        if (result.totalFindings > 0) {
          process.exit(1);
        }
      } catch (err: any) {
        console.error(c.err(`AutoSDE failed: ${err.message}`));
        process.exit(2);
      }
    });

  // zh autosde-sessions — look up past sessions
  program
    .command('autosde-sessions')
    .description('List recent AutoSDE sessions')
    .option('-n, --limit <n>', 'Number of entries to show', '10')
    .action(async (options: { limit: string }) => {
      const recent = sessions.list(parseInt(options.limit, 10));
      if (recent.length === 0) {
        empty('No sessions yet.');
        return;
      }

      for (const entry of recent) {
        const age = formatAge(entry.timestamp);
        const status = entry.findings === 0
          ? c.ok('pass')
          : c.err(`${entry.findings} findings (${entry.blocking} blocking)`);

        console.log(`${c.dim(age)}  ${entry.branch}  ${status}`);
        console.log(`  session: ${entry.sessionId}`);
        console.log(`  packages: ${entry.packages.join(', ')}`);
        console.log();
      }
    });
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
