import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { c, header } from '../lib/ui.js';
import { $ } from 'bun';

/**
 * zh each <cmd> -- run a command in every git repo, in parallel.
 */
export function registerEachCommand(program: Command): void {
  program
    .command('each')
    .argument('<cmd...>', 'Command to run in each repo')
    .description('Run a command in every repo (parallel)')
    .option('-s, --sequential', 'Run sequentially instead of parallel')
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (cmd: string[], options: { sequential?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const packages = await ws.packages();
      const command = cmd.join(' ');

      if (options.sequential) {
        for (const pkg of packages) {
          console.log(`${c.header(`=== ${pkg.name} ===`)}`);
          const proc = Bun.spawn(['sh', '-c', command], {
            cwd: pkg.path,
            stdout: 'inherit',
            stderr: 'inherit',
          });
          await proc.exited;
          console.log();
        }
      } else {
        // Parallel: collect output, then print grouped
        const results = await Promise.allSettled(
          packages.map(async (pkg) => {
            const proc = Bun.spawn(['sh', '-c', command], {
              cwd: pkg.path,
              stdout: 'pipe',
              stderr: 'pipe',
            });

            const [stdout, stderr] = await Promise.all([
              new Response(proc.stdout).text(),
              new Response(proc.stderr).text(),
            ]);

            const exitCode = await proc.exited;
            return { pkg, stdout, stderr, exitCode };
          }),
        );

        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { pkg, stdout, stderr, exitCode } = r.value;
            const hasOutput = stdout.trim() || stderr.trim();
            if (hasOutput || exitCode !== 0) {
              console.log(c.header(`=== ${pkg.name} ===`));
              if (stdout.trim()) console.log(stdout.trimEnd());
              if (stderr.trim()) console.log(c.err(stderr.trimEnd()));
              if (exitCode !== 0) console.log(c.err(`exit ${exitCode}`));
              console.log();
            }
          } else {
            console.log(c.err(`Failed: ${r.reason}`));
          }
        }
      }
    });
}
