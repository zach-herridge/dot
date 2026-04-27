import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import type { Package } from '../domain/package.js';
import { parallel } from '../lib/runner.js';
import { c, table, header, empty } from '../lib/ui.js';

/**
 * zh status -- unified view of all repos.
 * Shows branch, ahead/behind, dirty files in one formatted table.
 * Replaces the old ws status, ws branches, and ws diff commands.
 */

interface PkgStatus {
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  fileCount: number;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .alias('st')
    .description('Show status across all repos (branches, changes, ahead/behind)')
    .option('-d, --diff', 'Include diff stats for dirty repos')
    .option('-a, --all', 'Show all repos, not just interesting ones')
    .action(async (options: { diff?: boolean; all?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const packages = await ws.packages();
      if (packages.length === 0) {
        empty('No packages found');
        return;
      }

      // Fetch status for all packages in parallel
      const results = await parallel(packages, async (pkg) => {
        const [status, ab] = await Promise.all([pkg.status(), pkg.aheadBehind()]);
        return {
          branch: status.branch,
          ahead: ab.ahead,
          behind: ab.behind,
          dirty: status.dirty,
          fileCount: status.files.length,
        } satisfies PkgStatus;
      });

      // Filter to interesting repos unless --all
      const rows = results.filter((r) => {
        if (r.error) return true;
        if (options.all) return true;
        const s = r.result!;
        return s.dirty || s.ahead > 0 || s.behind > 0 || s.branch !== 'mainline';
      });

      if (rows.length === 0) {
        empty(`All ${packages.length} repos clean on mainline`);
        return;
      }

      // Build table
      const tableRows: string[][] = [];

      for (const r of rows) {
        if (r.error) {
          tableRows.push([c.pkg(r.pkg.name), c.err('error'), '', '']);
          continue;
        }

        const s = r.result!;
        const branchStr = s.branch === 'mainline' ? c.dim('mainline') : c.branch(s.branch);

        // Ahead/behind indicator
        const parts: string[] = [];
        if (s.ahead > 0) parts.push(c.ok(`+${s.ahead}`));
        if (s.behind > 0) parts.push(c.warn(`-${s.behind}`));
        const abStr = parts.length > 0 ? parts.join(' ') : c.dim('-');

        // Dirty indicator
        const dirtyStr = s.dirty ? c.warn(`${s.fileCount} changed`) : c.dim('clean');

        tableRows.push([c.pkg(r.pkg.name), branchStr, abStr, dirtyStr]);
      }

      const shown = rows.length;
      const hidden = results.length - shown;
      header(`${ws.name}`);
      console.log();
      table(tableRows);

      if (hidden > 0) {
        console.log();
        empty(`  ${hidden} clean repos hidden (use --all to show)`);
      }

      // Optionally show diff stats
      if (options.diff) {
        const dirty = results.filter((r) => r.result?.dirty);
        if (dirty.length > 0) {
          console.log();
          header('Diffs');
          for (const r of dirty) {
            console.log();
            console.log(`  ${c.pkg(r.pkg.name)}`);
            const stat = await r.pkg.diffStat();
            if (stat.trim()) {
              for (const line of stat.trim().split('\n')) {
                console.log(`    ${line}`);
              }
            }
          }
        }
      }
    });
}
