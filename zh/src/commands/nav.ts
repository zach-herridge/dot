import type { Command } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { Workspace } from '../domain/workspace.js';
import { c, nav } from '../lib/ui.js';

const NAV_FILE = '/tmp/zh-nav';

/**
 * zh <pkg> -- fuzzy navigate to a package.
 *
 * Writes target path to /tmp/zh-nav for the shell wrapper to cd into.
 * If multiple matches, pipes through fzf for selection.
 */
export function registerNavCommand(program: Command): void {
  program
    .command('nav')
    .argument('<query>', 'Package name (fuzzy match)')
    .description('Navigate to a package directory')
    .action(async (query: string) => {
      await navigate(query);
    });

  // Also handle bare "zh <pkg>" via the default command
  program.argument('[query]', 'Package name to navigate to').action(async (query?: string) => {
    if (query) {
      await navigate(query);
    }
  });
}

async function navigate(query: string): Promise<void> {
  const ws = Workspace.discover();
  if (!ws) {
    console.error(c.err('No workspace found (no packageInfo in parent dirs)'));
    process.exit(1);
  }

  const matches = await ws.findPackage(query);

  let targetPath: string;

  if (matches.length === 0) {
    // Fall back to directory match (non-git dirs)
    const allDirs = await ws.allDirs();
    const dirMatches = allDirs.filter((d) => d.toLowerCase().includes(query.toLowerCase()));

    if (dirMatches.length === 0) {
      console.error(c.err(`No match for '${query}'`));
      process.exit(1);
    } else if (dirMatches.length === 1) {
      targetPath = `${ws.srcDir}/${dirMatches[0]}`;
    } else {
      targetPath = await fzfSelect(dirMatches.map((d) => `${ws.srcDir}/${d}`));
    }
  } else if (matches.length === 1) {
    targetPath = matches[0].path;
  } else {
    targetPath = await fzfSelect(matches.map((m) => m.path));
  }

  // Write target for shell wrapper to cd into
  writeFileSync(NAV_FILE, targetPath);
  nav(c.pkg(targetPath.split('/').pop()!));
}

async function fzfSelect(paths: string[]): Promise<string> {
  const labels = paths.map((p) => p.split('/').pop()!);
  const proc = Bun.spawn(['fzf', '--height=10', '--layout=reverse'], {
    stdin: new Blob([labels.join('\n')]),
    stdout: 'pipe',
    stderr: 'inherit',
  });

  const output = await new Response(proc.stdout).text();
  const selected = output.trim();

  if (!selected) {
    process.exit(1);
  }

  const idx = labels.indexOf(selected);
  return paths[idx];
}
