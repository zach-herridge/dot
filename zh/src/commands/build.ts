import type { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { Workspace } from '../domain/workspace.js';
import { detect } from '../domain/build.js';
import { getDependencyGraph, expandTargets, topologicalLevels, type DependencyGraph } from '../domain/deps.js';
import { getLastDeploy, getChangedPackages } from '../domain/deploy.js';
import * as cache from '../lib/cache.js';
import { c, separator, empty, fzfSelect, formatDuration } from '../lib/ui.js';
import type { Package } from '../domain/package.js';

/**
 * zh build -- smart build with dirty-package detection, parallel execution,
 * captured output (show on failure only), and build timing.
 *
 * Replaces the bb/bbb workflow with something that actually knows what changed.
 */
export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .argument('[query]', 'Package name (fuzzy match)')
    .description('Build packages (smart defaults)')
    .option('-a, --all', 'Build all packages (recursive, like bbb)')
    .option('-d, --dirty', 'Build only packages with uncommitted changes')
    .option('--changed', 'Build packages changed since last deploy')
    .option('--full', 'Full recursive build via brazil-recursive-cmd')
    .option('--stream', 'Stream build output instead of capturing')
    .option('--fmt', 'Run ktlintFormat before building (Gradle packages)')
    .action(async (query: string | undefined, options: BuildOptions) => {
      const ws = Workspace.discover();
      if (!ws) {
        console.error(c.err('No workspace found (no packageInfo in parent dirs)'));
        process.exit(1);
      }

      // --full: delegate to brazil-recursive-cmd (respects dependency order)
      if (options.full || options.all) {
        await buildRecursive(ws, options);
        return;
      }

      // Determine what to build
      let targets = await resolveTargets(ws, query, options);
      if (targets.length === 0) return;

      // Expand targets to include intermediate packages on dependency paths.
      // E.g., if Model and UI are dirty, TSClient (between them) must also rebuild.
      if (targets.length > 1) {
        const graph = await getDependencyGraph(ws.root);
        const targetNames = new Set(targets.map((p) => p.name));
        const expanded = expandTargets(targetNames, graph);

        if (expanded.size > targetNames.size) {
          // New packages were added -- create Package objects for them
          const allPkgs = await ws.allSrcPackages();
          const byName = new Map(allPkgs.map((p) => [p.name, p]));
          const added: string[] = [];
          for (const name of expanded) {
            if (!targetNames.has(name)) {
              const pkg = byName.get(name);
              if (pkg && detect(pkg).system !== 'none') {
                targets.push(pkg);
                added.push(name);
              }
            }
          }
          if (added.length > 0) {
            console.log(
              c.dim(`  +${added.map((n) => c.pkg(n)).join(', ')} (dependency path)\n`),
            );
          }
        }
      }

      // Compute dependency ordering for multi-target builds
      const startTime = Date.now();
      let results: BuildResult[];

      if (targets.length === 1) {
        results = await buildSequential(targets, options);
      } else {
        const graph = await getDependencyGraph(ws.root);
        const levels = topologicalLevels(targets, graph);

        // Show build plan with dependency levels
        if (levels.length > 1) {
          for (let i = 0; i < levels.length; i++) {
            const names = levels[i].map((p) => c.pkg(p.name)).join(', ');
            const par = levels[i].length > 1 ? c.dim(' (parallel)') : '';
            console.log(`  ${c.dim(`${i + 1}.`)} ${names}${par}`);
          }
          console.log();
        } else if (targets.length > 1) {
          console.log(
            `  ${c.bold(`${targets.length}`)} packages to build ${c.dim('(parallel)')}\n`,
          );
        }

        if (options.stream) {
          // Stream mode: flatten levels into dependency-ordered sequence
          results = await buildSequential(levels.flat(), options);
        } else {
          results = await buildByLevel(levels, graph, options);
        }
      }

      const totalMs = Date.now() - startTime;

      // Summary
      printSummary(results, totalMs);

      // Save build SHAs for --changed tracking
      saveBuildShas(results.filter((r) => r.ok));

      if (results.some((r) => !r.ok)) process.exit(1);
    });
}

interface BuildOptions {
  all?: boolean;
  dirty?: boolean;
  changed?: boolean;
  full?: boolean;
  stream?: boolean;
  fmt?: boolean;
}

interface BuildResult {
  pkg: Package;
  ok: boolean;
  durationMs: number;
  output: string;
  logFile: string;
}

// ── Target Resolution ──────────────────────────────────────────────────────

async function resolveTargets(
  ws: Workspace,
  query: string | undefined,
  options: BuildOptions,
): Promise<Package[]> {
  // Explicit package query
  if (query) {
    const matches = await ws.findPackage(query);
    if (matches.length === 0) {
      console.error(c.err(`No package matching '${query}'`));
      process.exit(1);
    }
    if (matches.length === 1) return [matches[0]];
    const selected = await fzfSelect(matches.map((p) => p.name));
    return [matches.find((p) => p.name === selected)!];
  }

  // --changed: packages changed since last deploy
  if (options.changed) {
    const last = getLastDeploy();
    if (!last) {
      console.log(c.dim('  No deploy history. Building dirty packages instead.\n'));
      return getDirtyBuildablePackages(ws);
    }
    const changedNames = await getChangedPackages(ws, last.shas);
    if (changedNames.length === 0) {
      empty('  No packages changed since last deploy.');
      return [];
    }
    const all = await ws.packages();
    const changed = all.filter((p) => changedNames.includes(p.name));
    return filterBuildable(changed);
  }

  // --dirty: packages with uncommitted changes
  if (options.dirty) {
    return getDirtyBuildablePackages(ws);
  }

  // In a package dir: build current package
  const current = ws.currentPackage();
  if (current) {
    return [current];
  }

  // At workspace root: smart default -- dirty + unbuilt packages
  const dirty = await getDirtyBuildablePackages(ws);
  const unbuilt = getUnbuiltPackages(ws, await ws.packages());

  // Merge dirty + unbuilt, deduplicated
  const seen = new Set(dirty.map((p) => p.name));
  const merged = [...dirty];
  for (const pkg of unbuilt) {
    if (!seen.has(pkg.name)) {
      merged.push(pkg);
      seen.add(pkg.name);
    }
  }

  if (merged.length > 0) {
    const parts: string[] = [];
    if (dirty.length > 0) parts.push(`${dirty.length} dirty`);
    if (unbuilt.length > 0) parts.push(`${unbuilt.length} unbuilt`);
    console.log(c.dim(`  ${parts.join(', ')}\n`));
    return merged;
  }

  // No dirty or unbuilt -- try changed since last deploy
  const last = getLastDeploy();
  if (last) {
    const changedNames = await getChangedPackages(ws, last.shas);
    if (changedNames.length > 0) {
      const all = await ws.packages();
      const changed = filterBuildable(all.filter((p) => changedNames.includes(p.name)));
      if (changed.length > 0) {
        console.log(
          c.dim(`  ${changed.length} changed since last deploy\n`),
        );
        return changed;
      }
    }
  }

  empty('  Nothing to build. Use zh build <pkg> or zh build -a');
  return [];
}

async function getDirtyBuildablePackages(ws: Workspace): Promise<Package[]> {
  const all = await ws.packages();
  const dirty: Package[] = [];
  for (const pkg of all) {
    const status = await pkg.status();
    if (status.dirty) dirty.push(pkg);
  }
  return filterBuildable(dirty);
}

function filterBuildable(packages: Package[]): Package[] {
  return packages.filter((p) => {
    const info = detect(p);
    return info.system !== 'none';
  });
}

/** Find buildable packages missing workspace-level build output. */
function getUnbuiltPackages(ws: Workspace, packages: Package[]): Package[] {
  return filterBuildable(packages).filter((pkg) => {
    // Brazil writes build output to ws.root/build/<pkgName>/
    return !existsSync(join(ws.root, 'build', pkg.name));
  });
}

// ── Build Execution ────────────────────────────────────────────────────────

/** Resolve build args for a package. */
function buildArgs(pkg: Package, options: BuildOptions): string[] {
  const info = detect(pkg);
  if (options.fmt && info.system === 'gradle') {
    return ['brazil-build', 'ktlintFormat', 'release'];
  }
  return info.buildCommand.split(/\s+/);
}

/**
 * Build a single package, streaming output line-by-line to a log file.
 * Calls `onError` immediately when an error pattern is detected.
 * Used by both live (single) and parallel batch builds.
 */
async function buildOne(
  pkg: Package,
  options: BuildOptions,
  onError?: (line: string) => void,
): Promise<BuildResult> {
  const startTime = Date.now();
  const logFile = makeBuildLogPath(pkg.name);
  const logWriter = Bun.file(logFile).writer();
  const chunks: string[] = [];

  const args = buildArgs(pkg, options);
  const proc = Bun.spawn(args, {
    cwd: pkg.path,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  function handleLine(line: string): void {
    logWriter.write(line + '\n');
    chunks.push(line);
    if (onError) {
      const trimmed = line.trimStart();
      if (ERROR_PATTERNS.some((p) => p.test(trimmed))) {
        onError(trimmed);
      }
    }
  }

  const [, , exitCode] = await Promise.all([
    readLines(proc.stdout, handleLine),
    readLines(proc.stderr, handleLine),
    proc.exited,
  ]);

  logWriter.end();

  return {
    pkg,
    ok: exitCode === 0,
    durationMs: Date.now() - startTime,
    output: chunks.join('\n'),
    logFile,
  };
}

/** Build a single package with streamed output (--stream mode). */
async function buildOneStreamed(pkg: Package, options: BuildOptions): Promise<BuildResult> {
  const startTime = Date.now();
  const logFile = makeBuildLogPath(pkg.name);
  const args = buildArgs(pkg, options);

  const proc = Bun.spawn(args, {
    cwd: pkg.path,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;

  return { pkg, ok: exitCode === 0, durationMs: Date.now() - startTime, output: '', logFile };
}

/** Build packages sequentially (used for single package or --stream). */
async function buildSequential(
  targets: Package[],
  options: BuildOptions,
): Promise<BuildResult[]> {
  const results: BuildResult[] = [];

  for (const pkg of targets) {
    const info = detect(pkg);
    const fmtNote = options.fmt && info.system === 'gradle' ? ' (fmt + build)' : '';
    console.log(`  ${c.pkg(pkg.name)}${c.dim(fmtNote)}`);
    if (targets.length > 1) {
      separator();
      console.log();
    }

    const result = options.stream
      ? await buildOneStreamed(pkg, options)
      : await buildOneLive(pkg, options);
    results.push(result);

    if (targets.length > 1) {
      const status = result.ok
        ? c.ok(`built (${formatDuration(result.durationMs)})`)
        : c.err(`FAILED (${formatDuration(result.durationMs)})`);
      console.log(`  ${c.pkg(pkg.name)}  ${status}`);
      console.log();
    }
  }

  return results;
}

/**
 * Build a single package with inline error streaming (like zh test).
 * Shows "building..." indicator, prints errors as they appear,
 * writes full output to a log file.
 */
async function buildOneLive(pkg: Package, options: BuildOptions): Promise<BuildResult> {
  const info = detect(pkg);
  let hasErrors = false;

  process.stdout.write(`  ${c.dim('building...')}`);

  const result = await buildOne(pkg, options, (errorLine) => {
    if (!hasErrors) {
      // First error: clear "building..." and start error section
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      hasErrors = true;
    }
    console.log(`  ${errorLine}`);
  });

  if (!hasErrors) {
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
  }

  if (result.ok) {
    const fmtNote = options.fmt && info.system === 'gradle' ? c.dim(' (fmt)') : '';
    console.log(
      `  ${c.pkg(pkg.name)}${fmtNote}  ${c.ok('built')} ${c.dim(`(${formatDuration(result.durationMs)})`)}`,
    );
  } else {
    console.log(
      `  ${c.pkg(pkg.name)}  ${c.err('FAILED')} ${c.dim(`(${formatDuration(result.durationMs)})`)}`,
    );
    if (!hasErrors) {
      // No error patterns detected inline -- show extracted tail
      separator();
      console.log();
      for (const line of extractFailureOutput(result.output)) {
        console.log(line);
      }
    }
    console.log(c.dim(`  log: ${result.logFile}`));
    console.log();
  }

  return result;
}

/**
 * Build targets respecting dependency levels.
 * Levels run sequentially; packages within a level build in parallel.
 *
 * Only skips a package if one of its transitive dependencies (among targets)
 * failed. Unrelated failures in the same level don't block anything.
 * Uses transitive deps so UI is skipped when Model fails, even though
 * the direct dep (TSClient) isn't a target.
 */
async function buildByLevel(
  levels: Package[][],
  graph: DependencyGraph,
  options: BuildOptions,
): Promise<BuildResult[]> {
  const allResults: BuildResult[] = [];
  const failed = new Set<string>();

  for (const level of levels) {
    const buildable: Package[] = [];
    for (const pkg of level) {
      const deps = graph.transitive.get(pkg.name) ?? new Set();
      const failedDep = [...deps].find((d) => failed.has(d));
      if (failedDep) {
        console.log(
          `  ${c.pkg(pkg.name)}  ${c.dim('skipped')} ${c.dim(`(${failedDep} failed)`)}`,
        );
        allResults.push({ pkg, ok: false, durationMs: 0, output: '', logFile: '' });
        failed.add(pkg.name);
      } else {
        buildable.push(pkg);
      }
    }

    if (buildable.length === 0) continue;

    let levelResults: BuildResult[];
    if (buildable.length === 1) {
      levelResults = [await buildOneLive(buildable[0], options)];
    } else {
      levelResults = await buildParallelBatch(buildable, options);
    }

    for (const r of levelResults) {
      if (!r.ok) failed.add(r.pkg.name);
    }
    allResults.push(...levelResults);
  }

  return allResults;
}

/** Build a batch of independent packages in parallel with live status updates. */
async function buildParallelBatch(
  targets: Package[],
  options: BuildOptions,
): Promise<BuildResult[]> {
  for (const pkg of targets) {
    console.log(`  ${c.pkg(pkg.name)}  ${c.dim('building...')}`);
  }

  const moveUp = (n: number) => process.stdout.write(`\x1B[${n}A`);

  const results = await Promise.all(
    targets.map(async (pkg) => {
      // No inline errors for parallel -- too messy with cursor manipulation
      const result = await buildOne(pkg, options);

      const idx = targets.indexOf(pkg);
      moveUp(targets.length - idx);

      const info = detect(pkg);
      const fmtNote = options.fmt && info.system === 'gradle' ? c.dim(' (fmt)') : '';

      if (result.ok) {
        process.stdout.write(
          `\r  ${c.pkg(pkg.name)}${fmtNote}  ${c.ok('built')} ${c.dim(`(${formatDuration(result.durationMs)})`)}${''.padEnd(20)}\n`,
        );
      } else {
        process.stdout.write(
          `\r  ${c.pkg(pkg.name)}  ${c.err('FAILED')} ${c.dim(`(${formatDuration(result.durationMs)})`)}${''.padEnd(20)}\n`,
        );
      }

      const moveDown = targets.length - idx - 1;
      if (moveDown > 0) process.stdout.write(`\x1B[${moveDown}B`);

      return result;
    }),
  );

  console.log();

  // Show errors + log paths for failed builds
  const failures = results.filter((r) => !r.ok);
  for (const r of failures) {
    console.log(`  ${c.pkg(r.pkg.name)} ${c.err('build output:')}`);
    separator();
    console.log();
    for (const line of extractFailureOutput(r.output)) {
      console.log(line);
    }
    console.log(c.dim(`  log: ${r.logFile}`));
    console.log();
  }

  return results;
}

/** Full recursive build via brazil-recursive-cmd (= bbb). */
async function buildRecursive(ws: Workspace, options: BuildOptions): Promise<void> {
  console.log(c.dim('  building all packages (brazil-recursive-cmd)...'));

  if (options.stream) {
    separator();
    console.log();
    const proc = Bun.spawn(
      ['brazil-recursive-cmd', 'brazil-build', 'release', '--allPackages'],
      { cwd: ws.root, stdout: 'inherit', stderr: 'inherit' },
    );
    const exitCode = await proc.exited;
    console.log();
    if (exitCode === 0) {
      console.log(c.ok('  all packages built'));
    } else {
      console.log(c.err('  recursive build failed'));
      process.exit(1);
    }
    return;
  }

  // Captured mode: show progress, only dump on failure
  const startTime = Date.now();
  process.stdout.write(`  ${c.dim('building...')}`);

  const proc = Bun.spawn(
    ['brazil-recursive-cmd', 'brazil-build', 'release', '--allPackages'],
    { cwd: ws.root, stdout: 'pipe', stderr: 'pipe' },
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const durationMs = Date.now() - startTime;

  process.stdout.write('\r' + ' '.repeat(60) + '\r');

  if (exitCode === 0) {
    console.log(`  ${c.ok('all packages built')} ${c.dim(`(${formatDuration(durationMs)})`)}`);
  } else {
    console.log(`  ${c.err('recursive build failed')} ${c.dim(`(${formatDuration(durationMs)})`)}`);
    separator();
    console.log();
    for (const line of extractFailureOutput((stdout + '\n' + stderr).trim())) {
      console.log(line);
    }
    console.log();
    process.exit(1);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

function printSummary(results: BuildResult[], totalMs: number): void {
  if (results.length <= 1) {
    // Single package: result already printed inline
    if (results.length === 1 && !results[0].ok) {
      // failure output already shown
    } else if (results.length === 1 && results[0].ok) {
      // success already shown
    }
    return;
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log();
  if (failed === 0) {
    console.log(
      `  ${c.ok(`${passed}/${results.length} built`)} ${c.dim(`(${formatDuration(totalMs)})`)}`,
    );
  } else {
    console.log(
      `  ${c.ok(`${passed}`)} built, ${c.err(`${failed} failed`)} ${c.dim(`(${formatDuration(totalMs)})`)}`,
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function makeBuildLogPath(pkgName: string): string {
  const ts = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19);
  return `/tmp/zh-build-${pkgName}-${ts}.log`;
}

/** Read a ReadableStream line by line. */
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
    buffer = lines.pop()!;

    for (const line of lines) {
      onLine(line);
    }
  }

  if (buffer.length > 0) {
    onLine(buffer);
  }
}

// ── Error Extraction ──────────────────────────────────────────────────────

/**
 * Inline error patterns -- used during streaming to print errors as they happen.
 * Must be tight to avoid false positives (build might still succeed).
 *
 * "e: file.kt:12:5 ..." is a real Kotlin compilation error (has a file path).
 * "e: Daemon compilation failed" is a daemon hiccup, not user code.
 * "error: No public or protected classes found" is a Javadoc warning.
 */
const ERROR_PATTERNS = [
  /^e: .*\.\w+:\d+/,             // Kotlin error with file:line (e: Foo.kt:12: ...)
  /^FAILURE:/,                    // Gradle failure summary
  /^BUILD FAILED/,               // Gradle / Brazil build failed
  /^> Task .* FAILED/,           // Gradle task failure line
  /^Execution failed for task/,  // Gradle task execution failure
];

/**
 * Broader patterns for post-failure extraction (build already failed,
 * we want to find where the error starts in the captured output).
 */
const FAILURE_EXTRACT_PATTERNS = [
  ...ERROR_PATTERNS,
  /^e: /,                         // Any Kotlin error (broader)
  /^error:/i,                     // Java / generic compiler error
  /^What went wrong:/,            // Gradle error explanation
  /^ERROR:/,                      // Brazil / npm errors
];

function extractFailureOutput(output: string): string[] {
  const lines = output.split('\n');

  // Find the first line matching an error pattern
  let errorStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (FAILURE_EXTRACT_PATTERNS.some((p) => p.test(trimmed))) {
      errorStart = i;
      break;
    }
  }

  if (errorStart >= 0) {
    // Show from first error to end, capped at 80 lines
    return lines.slice(errorStart, errorStart + 80).filter((l) => l.trim());
  }

  // No marker found -- show last 60 lines
  return lines.slice(-60).filter((l) => l.trim());
}

// ── Build SHA Tracking ─────────────────────────────────────────────────────

const BUILD_SHAS_KEY = 'build-shas';

interface BuildShaRecord {
  shas: Record<string, string>; // package name → git SHA
}

export function getLastBuildShas(): Record<string, string> {
  const record = cache.get<BuildShaRecord>(BUILD_SHAS_KEY);
  return record?.shas ?? {};
}

function saveBuildShas(builtPackages: BuildResult[]): void {
  if (builtPackages.length === 0) return;

  const existing = getLastBuildShas();

  // Update SHAs for packages we just built
  for (const r of builtPackages) {
    try {
      const proc = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], { cwd: r.pkg.path });
      const sha = new TextDecoder().decode(proc.stdout).trim();
      if (sha) existing[r.pkg.name] = sha;
    } catch {
      // ignore
    }
  }

  cache.set(BUILD_SHAS_KEY, { shas: existing });
}
