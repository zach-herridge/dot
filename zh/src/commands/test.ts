import type { Command } from 'commander';
import { Workspace } from '../domain/workspace.js';
import { detect } from '../domain/build.js';
import { ensureCredentials } from '../domain/credentials.js';
import { getStage, DEFAULT_STAGE } from '../domain/stages.js';
import {
  c,
  separator,
  empty,
  fzfSelect,
  confirmWithTimeout,
  formatDuration,
  formatRelativeTime,
} from '../lib/ui.js';
import * as cache from '../lib/cache.js';
import type { Package } from '../domain/package.js';

/**
 * zh test  -- run unit tests (or integration tests with --integration).
 *
 * Unit tests: streams raw output (devs want full compiler/test output).
 * Integration tests: captures stream, shows live pass/fail counter,
 *   writes full log to /tmp, prints failure details at end.
 */
export function registerTestCommand(program: Command): void {
  program
    .command('test')
    .argument('[query]', 'Package name (fuzzy match)')
    .description('Run tests (unit by default, integration with -i)')
    .option('-a, --all', 'Run tests in all testable packages')
    .option('-i, --integration', 'Run integration tests (used by zhi)')
    .option('-r, --retry', 'Rerun only the failed tests from the last run')
    .option('--stage <stage>', 'Stage for integration tests', DEFAULT_STAGE)
    .option('--region <region>', 'AWS region for integration tests', 'us-east-1')
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (query: string | undefined, options: TestOptions) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found (no packageInfo in parent dirs)'));
        process.exit(1);
      }

      let passthrough = getPassthroughArgs();

      // Retry mode: load previous failures and inject --tests filters
      if (options.retry) {
        const prev = loadFailureCache();
        if (!prev) {
          console.error(c.err('No previous test failures to retry'));
          process.exit(1);
        }

        console.log(
          `  ${c.dim('retrying')} ${c.bold(`${prev.testFilters.length}`)} failed test${prev.testFilters.length !== 1 ? 's' : ''} ${c.dim(`from ${formatRelativeTime(new Date(prev.timestamp).toISOString())}`)}`,
        );
        for (const t of prev.testFilters) {
          console.log(`    ${c.dim(t)}`);
        }
        console.log();

        // Use cached settings and inject Gradle --tests filters
        query = prev.packageName;
        options.integration = true;
        options.stage = prev.stage;
        options.region = prev.region;
        passthrough = [...passthrough, ...prev.testFilters.flatMap((t) => ['--tests', t])];
      }

      if (options.integration) {
        await runIntegrationTests(ws, query, options, passthrough);
      } else {
        await runUnitTests(ws, query, options, passthrough);
      }
    });
}

interface TestOptions {
  all?: boolean;
  integration?: boolean;
  retry?: boolean;
  stage: string;
  region: string;
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

async function runUnitTests(
  ws: Workspace,
  query: string | undefined,
  options: TestOptions,
  passthrough: string[],
): Promise<void> {
  let packages: Package[];

  if (options.all) {
    const all = await ws.packages();
    packages = all.filter((p) => {
      const info = detect(p);
      return info.testCommand !== null || info.isIntegTestPackage;
    });
    if (packages.length === 0) {
      empty('No testable packages found.');
      return;
    }
  } else if (query) {
    const matches = await ws.findPackage(query);
    if (matches.length === 0) {
      console.error(c.err(`No package matching '${query}'`));
      process.exit(1);
    }
    packages =
      matches.length === 1 ? [matches[0]] : [await selectWithDefault(matches, LAST_UNIT_PKG_CACHE)];
  } else {
    const current = ws.currentPackage();
    if (current) {
      packages = [current];
    } else {
      packages = await findDirtyTestablePackages(ws);
      if (packages.length === 0) {
        // No dirty packages -- offer last tested package if cached
        const all = await ws.packages();
        const testable = all.filter((p) => detect(p).testCommand !== null);
        const lastPkg = cache.get<string>(LAST_UNIT_PKG_CACHE);
        if (lastPkg && testable.find((p) => p.name === lastPkg)) {
          const useDefault = await confirmWithTimeout(`  ${c.pkg(lastPkg)}?`, 5);
          if (useDefault) {
            packages = [testable.find((p) => p.name === lastPkg)!];
          } else {
            packages = [await selectWithDefault(testable, LAST_UNIT_PKG_CACHE)];
          }
        } else {
          empty('No dirty packages with tests. Use zh test <pkg> or zh test -a');
          return;
        }
      } else {
        console.log(
          c.dim(
            `  ${packages.length} dirty package${packages.length > 1 ? 's' : ''} with tests\n`,
          ),
        );
      }
    }
  }

  const results: { pkg: Package; ok: boolean }[] = [];

  for (const pkg of packages) {
    const info = detect(pkg);

    if (info.isIntegTestPackage && info.integTestCommand) {
      console.log(`  ${c.pkg(pkg.name)} ${c.dim('(integration test package)')}`);
      console.log(c.dim(`  ${info.integTestCommand}`));
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, info.integTestCommand, passthrough);
      results.push({ pkg, ok });
    } else if (info.testCommand) {
      console.log(`  ${c.pkg(pkg.name)} ${c.dim(info.testCommand)}`);
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, info.testCommand, passthrough);
      results.push({ pkg, ok });
    } else if (!options.all) {
      console.log(`  ${c.pkg(pkg.name)}  ${c.dim('no tests')}`);
    }

    if (packages.length > 1 && results.length < packages.length) console.log();
  }

  // Cache last tested package for default selection next time
  if (packages.length === 1) {
    saveLastPkg(LAST_UNIT_PKG_CACHE, packages[0]);
  }

  if (results.length > 1) {
    printRunSummary(results);
  } else if (results.length === 1) {
    console.log();
    console.log(results[0].ok ? c.ok('  passed') : c.err('  failed'));
  }

  if (results.some((r) => !r.ok)) process.exit(1);
}

// ── Integration Tests (captured output + live progress) ─────────────────────

async function runIntegrationTests(
  ws: Workspace,
  query: string | undefined,
  options: TestOptions,
  passthrough: string[],
): Promise<void> {
  // Pre-flight
  const stageConfig = getStage(options.stage);
  const stageName = options.stage.charAt(0).toUpperCase() + options.stage.slice(1).toLowerCase();
  const targetAccount = stageConfig?.account ?? '672626785854';

  console.log(c.dim('  pre-flight'));
  await ensureCredentials(targetAccount);
  console.log(`  ${c.dim('stage')}  ${c.bold(stageName)} ${c.dim(`(${options.region})`)}`);
  console.log();

  // Find targets
  const integPkgs = await ws.findIntegTestPackages();
  if (integPkgs.length === 0) {
    console.error(c.err('No integration test packages found'));
    process.exit(1);
  }

  let targets: Package[];

  if (options.all) {
    targets = integPkgs;
  } else if (query) {
    const matches = integPkgs.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      console.error(c.err(`No integration test package matching '${query}'`));
      console.log(c.dim(`  Available: ${integPkgs.map((p) => p.name).join(', ')}`));
      process.exit(1);
    }
    targets =
      matches.length === 1
        ? [matches[0]]
        : [await selectWithDefault(matches, LAST_INTEG_PKG_CACHE)];
  } else if (integPkgs.length === 1) {
    targets = [integPkgs[0]];
  } else {
    targets = [await selectWithDefault(integPkgs, LAST_INTEG_PKG_CACHE)];
  }

  // Build integration test packages first (capture output, only show on failure)
  for (const pkg of targets) {
    console.log(`  ${c.dim('building')} ${c.pkg(pkg.name)}${c.dim('...')}`);
    const buildResult = await capturedExec(pkg.path, 'brazil-build', []);
    if (!buildResult.ok) {
      console.log();
      console.log(c.err(`  Build failed for ${pkg.name}:`));
      separator();
      console.log();
      // Show last N lines of build output (the useful part)
      const lines = buildResult.output.split('\n');
      const tail = lines.slice(-60);
      for (const line of tail) {
        console.log(line);
      }
      process.exit(1);
    }
  }
  console.log();

  // Run tests
  const env = { STAGE: stageName, AWS_REGION: options.region };
  let anyFailed = false;
  const allFailedFilters: string[] = [];

  for (const pkg of targets) {
    const info = detect(pkg);
    const cmd = info.integTestCommand;
    if (!cmd) {
      console.log(`  ${c.pkg(pkg.name)}  ${c.dim('no integration test command')}`);
      continue;
    }

    const envDisplay = `STAGE=${stageName} AWS_REGION=${options.region}`;
    console.log(`  ${c.pkg(pkg.name)}`);
    console.log(c.dim(`  ${envDisplay} ${cmd}`));

    // Gradle packages get the captured progress display
    if (info.system === 'gradle') {
      const logFile = makeLogPath();
      console.log(c.dim(`  log: ${logFile}`));
      separator();
      console.log();
      const result = await runWithProgress(pkg.path, cmd, passthrough, env, logFile);
      printTestResult(result);
      if (!result.ok) {
        anyFailed = true;
        for (const f of result.failures) {
          allFailedFilters.push(toGradleFilter(f.name));
        }
      }
    } else {
      // npm / other: stream raw output (Jest has its own progress)
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, cmd, passthrough, env);
      console.log();
      console.log(ok ? c.ok('  passed') : c.err('  failed'));
      if (!ok) anyFailed = true;
    }

    if (targets.length > 1) console.log();
  }

  // Cache last tested package for default selection next time
  if (targets.length === 1) {
    saveLastPkg(LAST_INTEG_PKG_CACHE, targets[0]);
  }

  // Save failures for --retry, or clear on success
  if (allFailedFilters.length > 0) {
    saveFailureCache({
      timestamp: new Date().toISOString(),
      stage: options.stage,
      region: options.region,
      packageName: targets[0].name,
      testFilters: allFailedFilters,
    });
    console.log(c.dim(`  retry failures: zhi test -r`));
  } else if (!anyFailed) {
    cache.invalidate(FAILURE_CACHE_KEY);
  }

  if (anyFailed) process.exit(1);
}

// ── Gradle Progress Display ─────────────────────────────────────────────────

interface FailedTest {
  name: string;
  details: string[];
}

interface TestResult {
  ok: boolean;
  passed: number;
  failed: number;
  failures: FailedTest[];
  logFile: string;
  durationMs: number;
}

async function runWithProgress(
  cwd: string,
  command: string,
  passthrough: string[],
  extraEnv: Record<string, string>,
  logFile: string,
): Promise<TestResult> {
  const startTime = Date.now();
  const logWriter = Bun.file(logFile).writer();

  const parts = command.split(/\s+/);
  const args = [...parts, ...passthrough];

  const proc = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...extraEnv },
  });

  let passed = 0;
  let failed = 0;
  let testsStarted = false;
  const failures: FailedTest[] = [];
  let currentFailure: FailedTest | null = null;
  let inStderrBlock = false; // Track STANDARD_ERROR blocks to ignore their indented content

  function clearProgress(): void {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  function writeProgress(p: number, f: number): void {
    const total = p + f;
    const passStr = c.ok(`${p} passed`);
    const failStr = f > 0 ? `, ${c.err(`${f} failed`)}` : '';
    process.stdout.write(`\r  ${passStr}${failStr} ${c.dim(`(${total} total)`)}${''.padEnd(10)}`);
  }

  /** Print a failure detail line inline, clearing and restoring the progress counter. */
  function printInline(text: string): void {
    clearProgress();
    console.log(text);
    writeProgress(passed, failed);
  }

  function handleLine(line: string): void {
    logWriter.write(line + '\n');

    const clean = stripAnsi(line);

    // Detect when :integTest task begins
    if (!testsStarted && clean.includes(':integTest')) {
      testsStarted = true;
      writeProgress(0, 0);
      return;
    }

    // Show building indicator before tests start
    if (!testsStarted) {
      if (clean.includes('brazil-gradle') || clean.includes('Running build command')) {
        process.stdout.write(`\r  ${c.dim('building...')}${''.padEnd(30)}`);
      }
      return;
    }

    // STANDARD_ERROR block header -- these contain log noise from parallel tests, skip them
    if (/\(\)\s+STANDARD_ERROR\s*$/.test(clean)) {
      currentFailure = null;
      inStderrBlock = true;
      return;
    }

    // Test passed
    if (/\(\)\s+PASSED\s*$/.test(clean)) {
      passed++;
      currentFailure = null;
      inStderrBlock = false;
      writeProgress(passed, failed);
      return;
    }

    // Test failed -- print immediately so user can Ctrl+C and still see it
    const failMatch = clean.match(/^(.+\(\))\s+FAILED\s*$/);
    if (failMatch) {
      const name = failMatch[1].trim();
      failed++;
      currentFailure = { name, details: [] };
      failures.push(currentFailure);
      inStderrBlock = false;

      printInline(`\n  ${c.err('FAIL')}  ${name}`);
      return;
    }

    // Indented lines after FAILED -- capture details and print meaningful ones inline
    if (currentFailure && /^\s{4}/.test(clean)) {
      const detail = clean.trimStart();
      currentFailure.details.push(detail);

      // Print the first line (exception) and any lines matching our project source
      if (currentFailure.details.length === 1 || /\.kt:\d+\)$/.test(detail)) {
        printInline(`        ${c.dim(detail)}`);
      }
      return;
    }

    // Indented lines inside a STANDARD_ERROR block -- just ignore (logged to file)
    if (inStderrBlock && /^\s{4}/.test(clean)) {
      return;
    }

    // Non-indented, non-empty line ends any active block
    if (clean.trim().length > 0 && !/^\s/.test(clean)) {
      currentFailure = null;
      inStderrBlock = false;
    }
  }

  // Route both stdout and stderr through handleLine so we catch details
  // regardless of which stream Gradle sends them on
  const [, , exitCode] = await Promise.all([
    readLines(proc.stdout, handleLine),
    readLines(proc.stderr, handleLine),
    proc.exited,
  ]);

  logWriter.end();

  // Clear the in-place progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  return {
    ok: exitCode === 0 && failed === 0,
    passed,
    failed,
    failures,
    logFile,
    durationMs: Date.now() - startTime,
  };
}

function printTestResult(r: TestResult): void {
  const total = r.passed + r.failed;
  const dur = formatDuration(r.durationMs);

  // Build failed before tests ran
  if (total === 0 && !r.ok) {
    console.log(`  ${c.err('build failed')} ${c.dim(`(${dur})`)}`);
    return;
  }

  // All passed
  if (r.failed === 0 && r.ok) {
    console.log(`  ${c.ok(`${r.passed}/${total} passed`)} ${c.dim(`(${dur})`)}`);
    return;
  }

  // Some failed -- details were already printed inline during the run,
  // so the summary is just the final count
  console.log();
  console.log(
    `  ${c.ok(`${r.passed}`)}/${total} passed, ${c.err(`${r.failed} failed`)} ${c.dim(`(${dur})`)}`,
  );
}

// ── Failure Retry Cache ────────────────────────────────────────────────────

const FAILURE_CACHE_KEY = 'test-failures';

interface FailureCache {
  timestamp: string;
  stage: string;
  region: string;
  packageName: string;
  testFilters: string[]; // Gradle --tests patterns
}

function saveFailureCache(data: FailureCache): void {
  cache.set(FAILURE_CACHE_KEY, data);
}

function loadFailureCache(): FailureCache | null {
  // Expire after 24 hours
  return cache.get<FailureCache>(FAILURE_CACHE_KEY, 24 * 60 * 60 * 1000) ?? null;
}

/**
 * Convert Gradle test name to a --tests filter pattern.
 * "CapabilityResolverIntegrationTest > ExternalCoverage > IR-63 method()"
 *   → "CapabilityResolverIntegrationTest.ExternalCoverage.IR-63 method"
 */
function toGradleFilter(testName: string): string {
  return testName.replace(/\s*>\s*/g, '.').replace(/\(\)$/, '');
}

// ── Captured Exec (for build step) ─────────────────────────────────────────

/** Run a command capturing all output. Returns ok + combined output string. */
async function capturedExec(
  cwd: string,
  command: string,
  args: string[],
): Promise<{ ok: boolean; output: string }> {
  const parts = command.split(/\s+/);
  const proc = Bun.spawn([...parts, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const chunks: string[] = [];

  await Promise.all([
    readLines(proc.stdout, (line) => chunks.push(line)),
    readLines(proc.stderr, (line) => chunks.push(line)),
  ]);

  const exitCode = await proc.exited;
  return { ok: exitCode === 0, output: chunks.join('\n') };
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

async function findDirtyTestablePackages(ws: Workspace): Promise<Package[]> {
  const all = await ws.packages();
  const dirty: Package[] = [];
  for (const pkg of all) {
    const status = await pkg.status();
    if (status.dirty) {
      const info = detect(pkg);
      if (info.testCommand || info.integTestCommand) dirty.push(pkg);
    }
  }
  return dirty;
}

/** Run a command with stdout/stderr inherited (streamed to terminal). */
async function streamCommand(
  cwd: string,
  command: string,
  passthrough: string[],
  extraEnv?: Record<string, string>,
): Promise<boolean> {
  const parts = command.split(/\s+/);
  const proc = Bun.spawn([...parts, ...passthrough], {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
  });
  return (await proc.exited) === 0;
}

/** Read a ReadableStream line by line, calling onLine for each. */
async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!; // last element is the incomplete line

    for (const line of lines) {
      onLine(line);
    }
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    onLine(buffer);
  }
}

function makeLogPath(): string {
  const ts = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19);
  return `/tmp/zh-integ-${ts}.log`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const LAST_UNIT_PKG_CACHE = 'test-last-unit-pkg';
const LAST_INTEG_PKG_CACHE = 'test-last-integ-pkg';

/** Select a package, defaulting to the last selection with a 5s timeout. */
async function selectWithDefault(packages: Package[], cacheKey: string): Promise<Package> {
  const names = packages.map((p) => p.name);
  const lastPkg = cache.get<string>(cacheKey);

  if (lastPkg && names.includes(lastPkg)) {
    const useDefault = await confirmWithTimeout(`  ${c.pkg(lastPkg)}?`, 5);
    if (useDefault) {
      return packages.find((p) => p.name === lastPkg)!;
    }
  }

  const selected = await fzfSelect(names);
  return packages.find((p) => p.name === selected)!;
}

function saveLastPkg(cacheKey: string, pkg: Package): void {
  cache.set(cacheKey, pkg.name);
}

function getPassthroughArgs(): string[] {
  const idx = process.argv.indexOf('--');
  if (idx === -1) return [];
  return process.argv.slice(idx + 1);
}

function printRunSummary(results: { pkg: Package; ok: boolean }[]): void {
  console.log();
  separator();
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  for (const r of results) {
    const status = r.ok ? c.ok('passed') : c.err('FAILED');
    console.log(`  ${c.pkg(r.pkg.name)}  ${status}`);
  }

  console.log();
  if (failed > 0) {
    console.log(c.err(`  ${failed} failed, ${passed} passed`));
  } else {
    console.log(c.ok(`  ${passed}/${results.length} passed`));
  }
}
