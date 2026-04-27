import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import type { Package } from '../domain/package.js';
import * as git from '../domain/git.js';
import { c, header, table, empty, confirm, crAction, fzfMultiSelect } from '../lib/ui.js';
import { createSpinner } from 'nanospinner';

/**
 * zh prep -- the crown jewel.
 * Squash commits, rebase onto mainline, generate commit messages with Claude in parallel.
 * Full CR preparation in one command.
 */
export function registerPrepCommand(program: Command): void {
  program
    .command('prep')
    .description('Squash, rebase, and generate commit messages with Claude')
    .option('-n, --dry-run', 'Show what would happen without making changes')
    .action(async (options: { dryRun?: boolean }) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found'));
        process.exit(1);
      }

      const packages = await ws.packages();

      // --- Phase 0: Dirty repo check ---
      const dirtyPkgs: { pkg: Package; files: string[] }[] = [];
      for (const pkg of packages) {
        const status = await pkg.status();
        if (status.dirty) {
          dirtyPkgs.push({ pkg, files: status.files });
        }
      }

      if (dirtyPkgs.length > 0) {
        console.log(c.warn('Dirty repos:'));
        for (const { pkg, files } of dirtyPkgs) {
          console.log(`  ${c.pkg(pkg.name)}:`);
          for (const f of files) {
            console.log(`    ${f}`);
          }
        }
        console.log();

        const yes = await confirm('Commit all with WIP message?');
        if (!yes) {
          console.log('Aborted.');
          process.exit(1);
        }

        for (const { pkg } of dirtyPkgs) {
          await git.commitAll(pkg.path, 'WIP');
        }
        console.log();
      }

      // --- Phase 1: Fetch & discover (parallel) ---
      const spinner = createSpinner('Fetching...').start();

      interface Changed {
        pkg: Package;
        ahead: number;
      }

      const changed: Changed[] = [];
      let skipped = 0;

      await Promise.all(
        packages.map(async (pkg) => {
          await pkg.fetch().catch(() => {});
          const ab = await pkg.aheadBehind();
          if (ab.ahead > 0) {
            changed.push({ pkg, ahead: ab.ahead });
          } else {
            skipped++;
          }
        }),
      );

      spinner.stop();
      // Clear the spinner line
      process.stdout.write('\r\x1b[K');

      if (changed.length === 0) {
        empty(`All ${skipped} repos up to date.`);
        return;
      }

      console.log(`${changed.length} repos with changes ${c.dim(`(${skipped} up to date)`)}`);
      console.log();

      // --- Dry run: show what would happen ---
      if (options.dryRun) {
        for (const { pkg, ahead } of changed) {
          console.log(`  ${c.pkg(pkg.name)}  ${c.dim(`${ahead} commits`)}`);
          const log = await pkg.log('origin/mainline..HEAD');
          for (const line of log.trim().split('\n')) {
            console.log(`    ${c.dim(line)}`);
          }
        }
        return;
      }

      // --- Phase 2: Backup, rebase, squash ---
      const spinner2 = createSpinner('Squashing...').start();

      interface PrepResult {
        pkg: Package;
        status: 'ready' | 'conflict';
        backup: string;
        ahead: number;
        origMsgs?: string;
        diffStat?: string;
        diff?: string;
      }

      const prepResults: PrepResult[] = [];

      for (const { pkg, ahead } of changed) {
        const branch = await pkg.currentBranch();
        const backup = `backup/${branch}-${dateStamp()}`;
        await git.createBranch(pkg.path, backup);

        // Rebase
        const rebaseResult = await pkg.rebase();
        if (!rebaseResult.success) {
          prepResults.push({ pkg, status: 'conflict', backup, ahead });
          continue;
        }

        // Capture original commit messages before squash
        const origMsgs = await pkg.log('origin/mainline..HEAD', '--format=- %s');

        // Squash: soft reset to mainline, then commit
        await git.resetSoft(pkg.path, 'origin/mainline');
        await git.commitAll(pkg.path, 'WIP: squashed for CR');

        // Capture diff info for Claude
        const diffStat = await pkg.diffStat('origin/mainline');
        const diff = (await pkg.diff('origin/mainline')).slice(0, 12000); // Larger limit in JS

        prepResults.push({ pkg, status: 'ready', backup, ahead, origMsgs, diffStat, diff });
      }

      spinner2.stop();
      process.stdout.write('\r\x1b[K');

      // Show squash results
      const readyPkgs = prepResults.filter((r) => r.status === 'ready');
      const conflictPkgs = prepResults.filter((r) => r.status === 'conflict');

      for (const r of prepResults) {
        if (r.status === 'ready') {
          console.log(`  ${c.pkg(r.pkg.name)}  ${c.dim(`${r.ahead} commits -> 1`)}`);
        } else {
          console.log(
            `  ${c.pkg(r.pkg.name)}  ${c.err('CONFLICT')} ${c.dim(`(backup: ${r.backup})`)}`,
          );
        }
      }

      // --- Phase 3: Generate commit messages with Claude (parallel) ---
      if (readyPkgs.length > 0) {
        console.log();
        const spinner3 = createSpinner(
          `Generating commit messages (${readyPkgs.length} parallel)...`,
        ).start();

        const claudeResults = await Promise.allSettled(
          readyPkgs.map(async (r) => {
            const prompt = buildClaudePrompt(r.origMsgs!, r.diffStat!, r.diff!);
            const tmpFile = `/tmp/claude-commit-${r.pkg.name}.txt`;

            const proc = Bun.spawn(
              ['claude', '-p', '--output-format', 'text', '--model', 'sonnet', '--bare', '--tools', ''],
              {
                stdin: new Blob([prompt]),
                stdout: 'pipe',
                stderr: 'pipe',
              },
            );

            const output = await new Response(proc.stdout).text();
            await proc.exited;

            // Parse commit message from markers
            const match = output.match(/COMMIT_START\n([\s\S]*?)\nCOMMIT_END/);
            if (!match) {
              // Save raw output for debugging
              await Bun.write(tmpFile, output);
              return { pkg: r.pkg, success: false as const, tmpFile };
            }

            const commitMsg = match[1].trim();
            await git.amendMessage(r.pkg.path, commitMsg);

            return { pkg: r.pkg, success: true as const, title: commitMsg.split('\n')[0] };
          }),
        );

        spinner3.stop();
        process.stdout.write('\r\x1b[K');

        // --- Summary ---
        const succeeded: { name: string; title: string }[] = [];
        const failed: { name: string; tmpFile: string }[] = [];

        for (const r of claudeResults) {
          if (r.status === 'fulfilled') {
            if (r.value.success) {
              succeeded.push({ name: r.value.pkg.name, title: r.value.title });
            } else {
              failed.push({ name: r.value.pkg.name, tmpFile: r.value.tmpFile });
            }
          }
        }

        if (succeeded.length > 0) {
          console.log(c.ok('Ready for CR:'));
          const rows = succeeded.map((s) => [c.pkg(s.name), s.title]);
          table(rows);
        }

        if (failed.length > 0) {
          console.log();
          console.log(c.warn('Failed (run git commit --amend):'));
          const rows = failed.map((f) => [c.pkg(f.name), c.dim(f.tmpFile)]);
          table(rows);
        }
      }

      if (conflictPkgs.length > 0) {
        console.log();
        console.log(c.err('Conflicts (resolve or git rebase --abort):'));
        for (const r of conflictPkgs) {
          console.log(`  ${c.pkg(r.pkg.name)}`);
        }
      }

      // --- Phase 4: Offer to open CR ---
      if (readyPkgs.length > 0 && conflictPkgs.length === 0) {
        console.log();
        const action = await crAction(10);

        if (action !== 'skip') {
          let targetPkgs = readyPkgs;

          if (action === 'select') {
            const names = readyPkgs.map((r) => r.pkg.name);
            const selected = await fzfMultiSelect(names, {
              header: 'Tab to toggle, Enter to confirm',
            });
            if (selected.length === 0) {
              console.log(c.dim('  No repos selected.'));
              return;
            }
            targetPkgs = readyPkgs.filter((r) => selected.includes(r.pkg.name));
          }

          process.stdout.write(`  ${c.dim('creating...')}`);

          if (targetPkgs.length === readyPkgs.length) {
            // All repos -- single CR via cr --all
            const proc = Bun.spawn(['cr', '--all'], {
              cwd: ws.root,
              stdin: new Blob(['0\n']),
              stdout: 'pipe',
              stderr: 'pipe',
            });
            const [stdout, stderr] = await Promise.all([
              new Response(proc.stdout).text(),
              new Response(proc.stderr).text(),
            ]);
            const exitCode = await proc.exited;

            process.stdout.write('\r' + ' '.repeat(40) + '\r');

            if (exitCode === 0) {
              const url = (stdout + stderr).match(/https:\/\/code\.amazon\.com\/reviews\/CR-\S+/);
              if (url) {
                console.log(`  ${c.ok('CR created')}  ${url[0]}`);
              } else {
                console.log(c.ok('  CR created'));
              }
            } else {
              console.log(c.err('  cr failed'));
              const lines = (stdout + stderr).trim().split('\n').slice(-5);
              for (const line of lines) console.log(`  ${c.dim(line)}`);
            }
          } else {
            // Subset -- individual CR per package
            process.stdout.write('\r' + ' '.repeat(40) + '\r');
            const crResults: { name: string; url?: string; ok: boolean }[] = [];

            for (const r of targetPkgs) {
              process.stdout.write(`  ${c.dim(`creating ${r.pkg.name}...`)}`);
              const proc = Bun.spawn(['cr'], {
                cwd: r.pkg.path,
                stdin: new Blob(['0\n']),
                stdout: 'pipe',
                stderr: 'pipe',
              });
              const [stdout, stderr] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
              ]);
              const exitCode = await proc.exited;
              process.stdout.write('\r' + ' '.repeat(60) + '\r');

              if (exitCode === 0) {
                const url = (stdout + stderr).match(
                  /https:\/\/code\.amazon\.com\/reviews\/CR-\S+/,
                );
                crResults.push({ name: r.pkg.name, url: url?.[0], ok: true });
              } else {
                crResults.push({ name: r.pkg.name, ok: false });
              }
            }

            const succeeded = crResults.filter((r) => r.ok);
            const failed = crResults.filter((r) => !r.ok);

            if (succeeded.length > 0) {
              console.log(c.ok('CRs created:'));
              const rows = succeeded.map((r) => [
                c.pkg(r.name),
                r.url ?? c.dim('(no URL found)'),
              ]);
              table(rows);
            }

            if (failed.length > 0) {
              console.log(c.err('CR failed:'));
              const rows = failed.map((r) => [c.pkg(r.name)]);
              table(rows);
            }
          }
        }
      }
    });
}

function buildClaudePrompt(origMsgs: string, diffStat: string, diff: string): string {
  return `Generate a git commit message for this diff. Format:
- Line 1: concise title (max 72 chars, imperative mood)
- Line 2: blank
- Lines 3+: bullet points summarizing key changes

Wrap response in markers exactly like this example:
COMMIT_START
Add label filtering to search API

- Extract label filters from search attributes
- Apply filters as term queries in OpenSearch
- Add unit tests for filter building
COMMIT_END

Original commits:
${origMsgs}

Stat:
${diffStat}

Diff (truncated, excludes lockfiles):
${diff}`;
}

function dateStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
