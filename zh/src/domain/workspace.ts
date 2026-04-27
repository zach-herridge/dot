import { readdir, stat } from 'fs/promises';
import { accessSync } from 'fs';
import { join, basename, dirname } from 'path';
import { Package } from './package.js';

/**
 * A Brazil workspace -- identified by a `packageInfo` file at its root.
 * Contains multiple packages under `src/`, each with its own git repo.
 */
export class Workspace {
  constructor(public readonly root: string) {}

  get name(): string {
    return basename(this.root);
  }

  get srcDir(): string {
    return join(this.root, 'src');
  }

  /**
   * Enumerate all packages (directories under src/ that contain .git).
   */
  async packages(): Promise<Package[]> {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    const packages: Package[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(this.srcDir, entry.name);
      const gitDir = join(pkgPath, '.git');
      try {
        const s = await stat(gitDir);
        if (s.isDirectory()) {
          packages.push(new Package(pkgPath, this));
        }
      } catch {
        // No .git directory -- not a tracked package
      }
    }

    return packages.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * List all directories under src/ (packages, whether git-tracked or not).
   */
  async allDirs(): Promise<string[]> {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }

  /**
   * All packages under src/ regardless of .git presence.
   * Used for dependency expansion -- generated packages (e.g., TypescriptClient)
   * may not have .git but still need to be built.
   */
  async allSrcPackages(): Promise<Package[]> {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => new Package(join(this.srcDir, e.name), this))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find a package by fuzzy substring match on name.
   * Returns exact match first, then substring matches.
   */
  async findPackage(query: string): Promise<Package[]> {
    const all = await this.packages();
    const lower = query.toLowerCase();

    // Exact match
    const exact = all.filter((p) => p.name.toLowerCase() === lower);
    if (exact.length > 0) return exact;

    // Substring match
    return all.filter((p) => p.name.toLowerCase().includes(lower));
  }

  /**
   * Detect which package the user is currently in (by cwd).
   * Returns null if not inside a package directory under src/.
   */
  currentPackage(): Package | null {
    const cwd = process.cwd();
    const prefix = this.srcDir + '/';
    if (!cwd.startsWith(prefix)) return null;
    const relative = cwd.slice(prefix.length);
    const pkgName = relative.split('/')[0];
    if (!pkgName) return null;
    return new Package(join(this.srcDir, pkgName), this);
  }

  /** Find the CDK package in this workspace. */
  async findCdkPackage(): Promise<Package | undefined> {
    const all = await this.packages();
    return all.find((p) => p.name.toLowerCase().includes('cdk'));
  }

  /** Find all integration test packages (name contains "IntegrationTests"). */
  async findIntegTestPackages(): Promise<Package[]> {
    const all = await this.packages();
    return all.filter((p) => p.name.toLowerCase().includes('integrationtests'));
  }

  /**
   * Walk up from cwd to find the workspace root (directory containing packageInfo).
   */
  static discover(from?: string): Workspace | null {
    let dir = from ?? process.cwd();
    while (dir !== '/') {
      const candidate = join(dir, 'packageInfo');
      if (fileExistsSync(candidate)) {
        return new Workspace(dir);
      }
      dir = dirname(dir);
    }
    return null;
  }
}

/** Sync file existence check (avoid async in hot path) */
function fileExistsSync(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}
