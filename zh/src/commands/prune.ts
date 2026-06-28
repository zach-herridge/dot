import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { parallel } from '../lib/runner.js';
import { c, header, confirm } from '../lib/ui.js';
import { $ } from 'bun';

/** A branch slated for deletion, with the repo it lives in. */
interface PrunePlanItem {
  pkgName: string;
  pkgPath: string;
  scope: 'local' | 'remote';
  branch: string;
}

/**
 * Resolve the default remote-branch owner. Brazil/Amazon remote branches are
 * namespaced as `<user>/<branch>`, so we need the current user's login. Prefer
 * git's configured user, fall back to $USER — never a hardcoded name.
 */
async function defaultUser(): Promise<string> {
  const fromGit = await $`git config user.name`.text().catch(() => '');
  const trimmed = fromGit.trim();
  if (trimmed) return trimmed;
  return process.env.USER ?? '';
}

/**
 * zh prune -- delete old local and remote branches across all repos.
 *
 * Remote deletion is destructive and irreversible (it runs `git push --delete`),
 * so the flow is: compute a read-only plan across every repo, show it, and
 * require explicit confirmation before deleting anything. `--dry-run` stops
 * after printing the plan.
 */
export function registerPruneCommand(program: Command): void {
  program
    .command('prune')
    .description('Delete old local and remote branches (yours)')
    .option('-n, --dry-run', 'Show what would be deleted, then stop')
    .option('-y, --yes', 'Skip the confirmation prompt (dangerous)')
    .option('--user <username>', 'Remote branch owner (default: git user / $USER)')
    .action(async (options: { dryRun?: boolean; yes?: boolean; user?: string }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const user = options.user ?? (await defaultUser());
      if (!user) {
        console.error(
          c.err('Could not determine remote branch owner; pass --user <username>'),
        );
        process.exit(1);
      }

      const packages = await ws.packages();
      header(`Scanning ${packages.length} repos for prunable branches (owner: ${user})...`);
      console.log();

      // ── Phase 1: build the plan (READ-ONLY — no deletions yet) ──────────────
      const scanned = await parallel(packages, async (pkg) => {
        const items: PrunePlanItem[] = [];

        // Local branches (not mainline, not the currently checked-out one).
        const current = await pkg.currentBranch();
        for (const b of await pkg.branches()) {
          if (b.name === 'mainline' || b.name === current) continue;
          items.push({ pkgName: pkg.name, pkgPath: pkg.path, scope: 'local', branch: b.name });
        }

        // Prune stale remote-tracking refs, then list remote branches OWNED by
        // the user. Match the `origin/<user>/...` owner prefix specifically, so
        // a branch that merely contains the name as a substring isn't caught.
        await $`git -C ${pkg.path} fetch --prune origin`.quiet().catch(() => {});
        const remoteRefs = await $`git -C ${pkg.path} for-each-ref --format=${'%(refname:short)'} refs/remotes/origin`
          .text()
          .catch(() => '');
        for (const ref of remoteRefs.trim().split('\n').filter(Boolean)) {
          const branch = ref.replace(/^origin\//, '');
          if (branch.startsWith(`${user}/`)) {
            items.push({ pkgName: pkg.name, pkgPath: pkg.path, scope: 'remote', branch });
          }
        }

        return items;
      });

      const plan = scanned.flatMap((r) => r.result ?? []);
      const localItems = plan.filter((i) => i.scope === 'local');
      const remoteItems = plan.filter((i) => i.scope === 'remote');

      if (plan.length === 0) {
        console.log(c.dim('Nothing to prune.'));
        return;
      }

      // ── Show the plan ───────────────────────────────────────────────────────
      let lastPkg = '';
      for (const item of plan) {
        if (item.pkgName !== lastPkg) {
          console.log(c.pkg(item.pkgName));
          lastPkg = item.pkgName;
        }
        const tag = item.scope === 'remote' ? c.warn('remote:') : c.dim('local: ');
        console.log(`  ${tag} ${item.branch}`);
      }
      console.log();
      console.log(
        `${c.bold(`${localItems.length}`)} local, ` +
          `${c.bold(`${remoteItems.length}`)} remote branch(es) across ${
            new Set(plan.map((i) => i.pkgName)).size
          } repo(s)`,
      );

      if (options.dryRun) {
        console.log(c.dim('\nDry run — nothing deleted.'));
        return;
      }

      // ── Phase 2: confirm, then delete ─────────────────────────────────────────
      if (!options.yes) {
        console.log();
        const warning =
          remoteItems.length > 0
            ? c.err(`This will DELETE ${remoteItems.length} REMOTE branch(es) (irreversible).`)
            : c.warn('This will delete the local branches listed above.');
        console.log(warning);
        const ok = await confirm('Proceed?', false); // default NO for a destructive op
        if (!ok) {
          console.log(c.dim('Aborted.'));
          return;
        }
      }

      let deletedLocal = 0;
      let deletedRemote = 0;
      const failures: string[] = [];

      for (const item of localItems) {
        try {
          await $`git -C ${item.pkgPath} branch -D ${item.branch}`.quiet();
          deletedLocal++;
        } catch {
          failures.push(`${item.pkgName} local:${item.branch}`);
        }
      }
      for (const item of remoteItems) {
        try {
          await $`git -C ${item.pkgPath} push origin --delete ${item.branch}`.quiet();
          deletedRemote++;
        } catch {
          failures.push(`${item.pkgName} remote:${item.branch}`);
        }
      }

      console.log();
      console.log(c.ok(`Deleted ${deletedLocal} local, ${deletedRemote} remote branches`));
      if (failures.length > 0) {
        console.log(c.err(`Failed to delete ${failures.length}:`));
        for (const f of failures) console.log(`  ${f}`);
      }
    });
}
