import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { ensureCredentials } from '../domain/credentials.js';
import {
  getStage,
  stageDisplayName,
  DEFAULT_STAGE,
  PIPELINE_URL,
  type StageConfig,
} from '../domain/stages.js';
import {
  parseTarget,
  matchStack,
  fullStackName,
  allStacks,
  getLastDeploy,
  getHistory,
  recordDeploy,
  getPackageShas,
  getChangedPackages,
  type DeployRecord,
} from '../domain/deploy.js';
import {
  c,
  header,
  separator,
  empty,
  confirm,
  prompt,
  fzfSelect,
  formatDuration,
  formatRelativeTime,
  table,
} from '../lib/ui.js';

/**
 * zh deploy -- deploy CDK stacks with fuzzy matching, stage guardrails,
 * credential pre-flight, deploy ledger, and smart repeat.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .argument('[target]', 'Stack name[@stage] (fuzzy match)')
    .description('Deploy CDK stacks')
    .option('--redo', 'Repeat last deployment (no prompts)')
    .option('--diff', 'Show CDK diff before deploying')
    .option('--hotswap', 'Lambda-only hotswap deploy (Devo only)')
    .option('--history', 'Show deployment log')
    .option('--override', 'Override stage guardrails')
    .action(async (target: string | undefined, options: DeployOptions) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found (no packageInfo in parent dirs)'));
        process.exit(1);
      }

      // -- History subcommand --
      if (options.history) {
        showHistory();
        return;
      }

      // Find CDK package
      const cdkPkg = await ws.findCdkPackage();
      if (!cdkPkg) {
        console.error(c.err('No CDK package found in workspace'));
        process.exit(1);
      }

      let stackName: string;
      let stageName: string;

      // -- Redo: instant replay --
      if (options.redo) {
        const last = getLastDeploy();
        if (!last) {
          console.error(c.err('No previous deploys. Use zh deploy <target>'));
          process.exit(1);
        }
        stackName = last.stack;
        stageName = last.stage;
        console.log(`  ${c.dim('redo')} ${c.bold(stackName)}`);
      }
      // -- Explicit target --
      else if (target) {
        const parsed = parseTarget(target);
        stageName = parsed.stage ?? DEFAULT_STAGE;
        const resolved = resolveStack(parsed.query, stageName);
        stackName = resolved;
      }
      // -- No target: smart repeat or interactive --
      else {
        const last = getLastDeploy();
        if (last) {
          await showLastDeployInfo(ws, last);
          const yes = await confirm('  Redeploy?');
          if (!yes) return;
          stackName = last.stack;
          stageName = last.stage;
        } else {
          // No history -- interactive stack selection
          console.log(c.dim('  No previous deploys. Select a stack:\n'));
          const stacks = allStacks(DEFAULT_STAGE);
          const selected = await fzfSelect(stacks);
          stackName = selected;
          stageName = DEFAULT_STAGE;
        }
      }

      // -- Stage guardrails --
      const stageConfig = getStage(stageName);
      if (!stageConfig) {
        console.error(c.err(`Unknown stage '${stageName}'`));
        process.exit(1);
      }

      const blocked = await enforceGuardrails(stageName, stageConfig, stackName, options);
      if (blocked) return;

      // -- Credential pre-flight (auto-refreshes via ada if expired) --
      console.log(
        `  ${c.dim('deploy')} ${c.bold(stackName)} ${c.dim('->')} ${stageDisplayName(stageName)} ${c.dim(`(${stageConfig.account})`)}`,
      );
      const creds = await ensureCredentials(stageConfig.account);
      if (!creds.valid) {
        const proceed = await confirm('  Credentials invalid. Continue anyway?');
        if (!proceed) return;
      }
      console.log();

      const startTime = Date.now();

      // -- CDK diff (optional) --
      if (options.diff) {
        console.log(c.dim(`  cdk diff ${stackName}`));
        separator();
        console.log();
        await exec(['brazil-build', 'cdk', 'diff', stackName], cdkPkg.path);
        console.log();

        const proceed = await confirm('  Deploy?');
        if (!proceed) return;
        console.log();
      }

      // -- Deploy --
      const deployArgs = ['brazil-build', 'cdk', 'deploy', stackName];
      if (options.hotswap) {
        deployArgs.push('--hotswap');
      }

      // Skip CDK's approval prompt for stages where zh guardrails already cover it,
      // or when hotswapping (lambda-only, low risk). For higher stages let CDK prompt
      // as a second gate.
      const stageGuardrail = getStage(stageName)?.confirmLevel ?? 'none';
      if (stageGuardrail === 'none' || options.hotswap) {
        deployArgs.push('--require-approval', 'never');
      }

      console.log(c.dim(`  deploying ${stackName}...`));
      separator();
      console.log();

      const ok = await exec(deployArgs, cdkPkg.path);
      const durationMs = Date.now() - startTime;

      console.log();
      if (ok) {
        console.log(
          `  ${c.ok('deployed')} ${c.bold(stackName)} ${c.dim(`(${formatDuration(durationMs)})`)}`,
        );
      } else {
        console.log(`  ${c.err('deploy failed')} ${c.dim(`(${formatDuration(durationMs)})`)}`);
      }

      // -- Record to ledger --
      if (ok) {
        const shas = await getPackageShas(ws);
        recordDeploy({
          stack: stackName,
          stage: stageName,
          timestamp: new Date().toISOString(),
          durationMs,
          hotswap: options.hotswap ?? false,
          shas,
        });
      }

      // -- Post-deploy hints --
      if (ok) {
        const stg = getStage(stageName);
        if (stg) {
          console.log();
          console.log(c.dim(`  tail logs:   zh logs ${stg.logGroup}`));
          console.log(c.dim(`  run integ:   zhi test`));
        }
      }

      if (!ok) process.exit(1);
    });
}

interface DeployOptions {
  redo?: boolean;
  diff?: boolean;
  hotswap?: boolean;
  history?: boolean;
  override?: boolean;
}

// ── Stack Resolution ────────────────────────────────────────────────────────

function resolveStack(query: string, stage: string): string {
  const matches = matchStack(query);

  if (matches.length === 0) {
    console.error(c.err(`No stack matching '${query}'`));
    console.log(c.dim(`  Known stacks: Service, FoundationalResources, BuilderToolbox`));
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error(c.err(`Ambiguous match '${query}': ${matches.join(', ')}`));
    process.exit(1);
  }

  return fullStackName(matches[0], stage);
}

// ── Stage Guardrails ────────────────────────────────────────────────────────

async function enforceGuardrails(
  stageName: string,
  config: StageConfig,
  stackName: string,
  options: DeployOptions,
): Promise<boolean> {
  if (options.override) return false; // User explicitly overriding

  switch (config.confirmLevel) {
    case 'none':
      return false;

    case 'prompt': {
      console.log();
      console.log(
        c.warn(`  !! ${stageDisplayName(stageName).toUpperCase()} deploy (${config.account})`),
      );
      console.log(c.dim('  This is a shared pre-production environment.'));
      console.log();
      const yes = await confirm(`  Deploy to ${stageDisplayName(stageName)}?`);
      if (!yes) {
        empty('  Cancelled.');
        return true;
      }
      console.log();
      return false;
    }

    case 'type-name': {
      console.log();
      console.log(
        c.err(`  !! ${stageDisplayName(stageName).toUpperCase()} deploy (${config.account})`),
      );
      console.log(c.warn('  This is a pre-production environment with customer-facing impact.'));
      console.log();
      const answer = await prompt(
        `  Type "${stageDisplayName(stageName)}" to confirm: `,
      );
      if (answer !== stageDisplayName(stageName)) {
        empty('  Cancelled.');
        return true;
      }
      console.log();
      return false;
    }

    case 'refuse': {
      console.log();
      console.log(c.err('  Prod deploys go through the pipeline.'));
      console.log(c.dim(`  Pipeline: ${PIPELINE_URL}`));
      console.log();
      console.log(c.dim(`  Override: zh deploy ${stackName}@prod --override`));
      return true;
    }
  }
}

// ── Last Deploy Info ────────────────────────────────────────────────────────

async function showLastDeployInfo(ws: Workspace, last: DeployRecord): Promise<void> {
  console.log(
    `  ${c.dim('last deploy:')} ${c.bold(last.stack)} ${c.dim(`(${formatRelativeTime(last.timestamp)})`)}`,
  );

  // Show changed packages since last deploy
  try {
    const changed = await getChangedPackages(ws, last.shas);
    if (changed.length > 0) {
      const display = changed.slice(0, 5).map((n) => c.pkg(n)).join(', ');
      const suffix = changed.length > 5 ? c.dim(` +${changed.length - 5} more`) : '';
      console.log(`  ${c.dim('changed:')}    ${display}${suffix}`);
    } else {
      console.log(`  ${c.dim('changed:')}    ${c.dim('none')}`);
    }
  } catch {
    // If SHA comparison fails, just skip change tracking
  }

  console.log();
}

// ── History ─────────────────────────────────────────────────────────────────

function showHistory(): void {
  const history = getHistory();

  if (history.length === 0) {
    empty('No deploy history.');
    return;
  }

  header('Deploy History');
  separator();

  const rows = history.slice(0, 15).map((r) => {
    const time = formatRelativeTime(r.timestamp);
    const shortStack = r.stack.replace(/^ArccApp-\w+-\d+-/, '');
    const stage = stageDisplayName(r.stage);
    const duration = formatDuration(r.durationMs);
    const hotswap = r.hotswap ? c.dim(' (hotswap)') : '';
    return [c.dim(time), `${shortStack}${c.dim('@')}${stage}`, c.dim(duration) + hotswap];
  });

  table(rows);
}

// ── Exec ────────────────────────────────────────────────────────────────────

async function exec(args: string[], cwd: string): Promise<boolean> {
  const proc = Bun.spawn(args, {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

