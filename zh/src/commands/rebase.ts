import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { parallel } from '../lib/runner.js';
import { c, table, header, empty } from '../lib/ui.js';

/**
 * zh rebase -- rebase all clean repos onto mainline, in parallel.
 */
export function registerRebaseCommand(program: Command): void {
  program
    .command('rebase')
    .description('Fetch and rebase all clean repos onto mainline')
    .action(async () => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const packages = await ws.packages();
      header(`Rebasing ${packages.length} repos...`);
      console.log();

      const results = await parallel(packages, async (pkg) => {
        const status = await pkg.status();
        if (status.dirty) {
          return { action: 'skipped' as const, reason: 'dirty' };
        }

        await pkg.fetch();
        const result = await pkg.rebase();

        if (result.conflict) {
          return { action: 'conflict' as const, reason: 'rebase conflict' };
        }

        return { action: 'ok' as const, reason: '' };
      });

      const rows: string[][] = [];
      let okCount = 0;
      let skipCount = 0;
      let conflictCount = 0;

      for (const r of results) {
        if (r.error) {
          rows.push([c.pkg(r.pkg.name), c.err('error')]);
          continue;
        }
        const { action, reason } = r.result!;
        switch (action) {
          case 'ok':
            okCount++;
            break;
          case 'skipped':
            skipCount++;
            rows.push([c.pkg(r.pkg.name), c.warn('SKIP: dirty')]);
            break;
          case 'conflict':
            conflictCount++;
            rows.push([c.pkg(r.pkg.name), c.err('CONFLICT')]);
            break;
        }
      }

      if (rows.length > 0) {
        table(rows);
        console.log();
      }

      const parts: string[] = [];
      if (okCount > 0) parts.push(c.ok(`${okCount} rebased`));
      if (skipCount > 0) parts.push(c.warn(`${skipCount} skipped`));
      if (conflictCount > 0) parts.push(c.err(`${conflictCount} conflicts`));
      console.log(parts.join(c.dim(' | ')));
    });
}
