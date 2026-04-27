import type { Package } from '../domain/package.js';
import { c } from './ui.js';

/**
 * Run an async operation across multiple packages in parallel.
 * Reports results as they complete with package-name prefixes.
 */

export interface RunResult<T> {
  pkg: Package;
  result?: T;
  error?: Error;
}

/**
 * Execute `fn` for each package with bounded concurrency.
 * Returns results in original package order.
 */
export async function parallel<T>(
  packages: Package[],
  fn: (pkg: Package) => Promise<T>,
  options?: { concurrency?: number; label?: string },
): Promise<RunResult<T>[]> {
  const concurrency = options?.concurrency ?? 8;
  const results: RunResult<T>[] = Array(packages.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < packages.length) {
      const idx = nextIndex++;
      const pkg = packages[idx];
      try {
        const result = await fn(pkg);
        results[idx] = { pkg, result };
      } catch (err) {
        results[idx] = { pkg, error: err as Error };
      }
    }
  }

  // Launch workers
  const workers = Array(Math.min(concurrency, packages.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/** Print a summary of parallel run results */
export function printSummary<T>(
  results: RunResult<T>[],
  formatResult: (pkg: Package, result: T) => string,
): void {
  const succeeded = results.filter((r) => r.result !== undefined);
  const failed = results.filter((r) => r.error !== undefined);

  for (const r of succeeded) {
    console.log(`  ${c.pkg(r.pkg.name)}  ${formatResult(r.pkg, r.result!)}`);
  }

  if (failed.length > 0) {
    console.log();
    for (const r of failed) {
      console.log(`  ${c.pkg(r.pkg.name)}  ${c.err(r.error!.message)}`);
    }
  }
}
