#!/usr/bin/env bun

import { Command } from 'commander';
import { registerNavCommand } from './commands/nav.js';
import { registerStatusCommand } from './commands/status.js';
import { registerLsCommand } from './commands/ls.js';
import { registerEachCommand } from './commands/each.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerRebaseCommand } from './commands/rebase.js';
import { registerPrepCommand } from './commands/prep.js';
import { registerPruneCommand } from './commands/prune.js';
import { registerBuildCommand } from './commands/build.js';
import { registerTestCommand } from './commands/test.js';
import { registerDeployCommand } from './commands/deploy.js';
import { Workspace } from './domain/workspace.js';

const program = new Command();

program
  .name('zh')
  .description('Personal workspace CLI')
  .version('0.1.0')
  .enablePositionalOptions();

// Register all commands
registerStatusCommand(program);
registerLsCommand(program);
registerEachCommand(program);
registerCleanCommand(program);
registerRebaseCommand(program);
registerPrepCommand(program);
registerPruneCommand(program);
registerBuildCommand(program);
registerTestCommand(program);
registerDeployCommand(program);

// Hidden helper for shell completion
program
  .command('_root', { hidden: true })
  .action(() => {
    const ws = Workspace.discover();
    if (ws) console.log(ws.root);
  });

// Nav must be last -- it uses .argument() as the fallback for bare "zh <pkg>"
registerNavCommand(program);

program.parse();
