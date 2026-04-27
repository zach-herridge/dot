import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { parallel } from '../lib/runner.js';
import * as git from '../domain/git.js';
import { c, header, table, empty } from '../lib/ui.js';
import { $ } from 'bun';

/**
 * zh prune -- delete old local and remote branches across all repos.
 */
export function registerPruneCommand(program: Command): void {
  program
    .command('prune')
    .description('Delete old local and remote branches (yours)')
    .option('-n, --dry-run', 'Show what would be deleted')
    .option('--user <username>', 'Remote branch owner', 'zachhe')
    .action(async (options: { dryRun?: boolean; user: string }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const packages = await ws.packages();
      header(`Pruning branches across ${packages.length} repos...`);
      console.log();

      let totalLocal = 0;
      let totalRemote = 0;

      const results = await parallel(packages, async (pkg) => {
        const deletedLocal: string[] = [];
        const deletedRemote: string[] = [];

        // Get current branch to avoid deleting it
        const current = await pkg.currentBranch();

        // Local branches (not mainline, not current)
        const localBranches = await pkg.branches();
        for (const b of localBranches) {
          if (b.name === 'mainline' || b.name === current) continue;

          if (options.dryRun) {
            deletedLocal.push(b.name);
          } else {
            try {
              await $`git -C ${pkg.path} branch -D ${b.name}`.quiet();
              deletedLocal.push(b.name);
            } catch {
              // skip
            }
          }
        }

        // Fetch --prune to clean up stale remote refs
        await $`git -C ${pkg.path} fetch --prune origin`.quiet().catch(() => {});

        // Remote branches owned by user
        const remoteRefs = await $`git -C ${pkg.path} for-each-ref --format=${'%(refname:short)'} refs/remotes/origin`
          .text()
          .catch(() => '');

        const userBranches = remoteRefs
          .trim()
          .split('\n')
          .filter((b) => b.includes(`/${options.user}/`));

        for (const ref of userBranches) {
          const remoteBranch = ref.replace('origin/', '');
          if (options.dryRun) {
            deletedRemote.push(remoteBranch);
          } else {
            try {
              await $`git -C ${pkg.path} push origin --delete ${remoteBranch}`.quiet();
              deletedRemote.push(remoteBranch);
            } catch {
              // skip
            }
          }
        }

        return { deletedLocal, deletedRemote };
      });

      // Print results
      for (const r of results) {
        if (r.error) continue;
        const { deletedLocal, deletedRemote } = r.result!;
        if (deletedLocal.length === 0 && deletedRemote.length === 0) continue;

        console.log(`${c.pkg(r.pkg.name)}`);
        for (const b of deletedLocal) {
          const prefix = options.dryRun ? 'would delete' : 'deleted';
          console.log(`  ${c.dim('local:')}  ${b}`);
          totalLocal++;
        }
        for (const b of deletedRemote) {
          console.log(`  ${c.dim('remote:')} ${b}`);
          totalRemote++;
        }
      }

      console.log();
      const verb = options.dryRun ? 'Would delete' : 'Deleted';
      console.log(`${verb} ${totalLocal} local, ${totalRemote} remote branches`);
    });
}
