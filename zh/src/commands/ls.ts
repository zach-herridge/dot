import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { c, empty } from '../lib/ui.js';

/**
 * zh ls -- list all packages in the workspace.
 */
export function registerLsCommand(program: Command): void {
  program
    .command('ls')
    .description('List packages in the workspace')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const dirs = await ws.allDirs();

      if (options.json) {
        console.log(JSON.stringify(dirs, null, 2));
        return;
      }

      if (dirs.length === 0) {
        empty('No packages found');
        return;
      }

      for (const d of dirs) {
        console.log(`  ${d}`);
      }
    });
}
