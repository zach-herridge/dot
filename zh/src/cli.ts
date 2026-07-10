#!/usr/bin/env bun

import { Command } from 'commander';
import { registerEachCommand } from './commands/each.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerAutoSdeCommand } from './commands/autosde.js';
import { registerCrCommand } from './commands/cr.js';

const program = new Command();

program
  .name('zh')
  .description('Personal workspace CLI')
  .version('0.1.0')
  .enablePositionalOptions();

// Register all commands
registerEachCommand(program);
registerCleanCommand(program);
registerAutoSdeCommand(program);
registerCrCommand(program);

program.parse();
