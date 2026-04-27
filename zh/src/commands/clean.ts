import type { Command } from 'commander';
import { readdir, rename, stat, lstat, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { Workspace } from '../domain/workspace.js';
import { c } from '../lib/ui.js';

/**
 * zh clean -- remove build artifacts across the workspace.
 *
 * Skips ws.packages() (which stat-checks .git dirs we don't need).
 * Instead: one readdir + all existence checks in parallel.
 */
export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove build artifacts (node_modules, build, dist)')
    .option('-n, --dry-run', 'Show what would be removed')
    .action(async (options: { dryRun?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const rootDirs = ['node_modules', 'build', 'dist', 'env'];
      const pkgDirs = ['node_modules', 'build', 'dist'];

      // One readdir instead of ws.packages() -- we don't need .git checks
      const entries = await readdir(ws.srcDir, { withFileTypes: true });
      const pkgNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      // Build all candidate paths, check existence in parallel
      const candidates = [
        ...rootDirs.map((d) => join(ws.root, d)),
        ...pkgNames.flatMap((name) => pkgDirs.map((d) => join(ws.srcDir, name, d))),
      ];

      // lstat (not stat) so symlinks aren't followed -- some Brazil packages
      // have a tracked `build` symlink pointing to workspace-level build output.
      // We only want to clean real directories, not those symlinks.
      const checks = await Promise.all(
        candidates.map(async (p) => {
          try {
            const s = await lstat(p);
            return s.isDirectory() ? p : null;
          } catch {
            return null;
          }
        }),
      );

      const targets = checks.filter((p): p is string => p !== null);

      if (targets.length === 0) {
        console.log(c.dim('Nothing to clean'));
        return;
      }

      if (options.dryRun) {
        console.log('Would remove:');
        for (const t of targets) {
          console.log(`  ${c.warn(t.replace(ws.root + '/', ''))}`);
        }
        return;
      }

      // Rename all targets into a workspace-local trash dir (instant, same filesystem).
      // Then spawn a detached `rm -rf` so the process can exit immediately.
      const trash = await mkdtemp(join(ws.root, '.zh-clean-'));
      await Promise.all(
        targets.map((t, i) => rename(t, join(trash, `${i}-${t.split('/').pop()}`))),
      );
      console.log(c.ok(`Removed ${targets.length} directories`));

      // Detached child process -- unref so the event loop doesn't wait for it
      Bun.spawn(['rm', '-rf', trash], {
        stdout: 'ignore',
        stderr: 'ignore',
        stdin: 'ignore',
      }).unref();
    });
}
