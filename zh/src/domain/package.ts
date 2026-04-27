import { basename } from 'path';
import type { Workspace } from './workspace.js';
import * as git from './git.js';

/**
 * A single package within a Brazil workspace.
 * Each package is a directory under src/ with its own git repo.
 */
export class Package {
  constructor(
    public readonly path: string,
    public readonly workspace: Workspace,
  ) {}

  get name(): string {
    return basename(this.path);
  }

  // -- Git operations (delegated to git.ts) --

  async status(): Promise<git.RepoStatus> {
    return git.status(this.path);
  }

  async currentBranch(): Promise<string> {
    return git.currentBranch(this.path);
  }

  async branches(): Promise<git.BranchInfo[]> {
    return git.branches(this.path);
  }

  async fetch(remote = 'origin', branch = 'mainline'): Promise<void> {
    return git.fetch(this.path, remote, branch);
  }

  async rebase(upstream = 'origin/mainline'): Promise<git.RebaseResult> {
    return git.rebase(this.path, upstream);
  }

  async diff(base = 'origin/mainline'): Promise<string> {
    return git.diff(this.path, base);
  }

  async diffStat(base?: string): Promise<string> {
    return git.diffStat(this.path, base);
  }

  async log(range?: string, format?: string): Promise<string> {
    return git.log(this.path, range, format);
  }

  async aheadBehind(upstream = 'origin/mainline'): Promise<{ ahead: number; behind: number }> {
    return git.aheadBehind(this.path, upstream);
  }
}
