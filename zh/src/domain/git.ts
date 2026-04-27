import { $ } from 'bun';

/**
 * Thin typed wrappers around git commands.
 * All functions take a `cwd` as their first argument.
 * Uses Bun's shell ($) for speed.
 */

export interface RepoStatus {
  dirty: boolean;
  files: string[];
  branch: string;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  upstream?: string;
  trackingStatus?: string; // e.g., "ahead 3, behind 1"
}

export interface RebaseResult {
  success: boolean;
  conflict: boolean;
}

/** Get porcelain status + current branch */
export async function status(cwd: string): Promise<RepoStatus> {
  const [statusOut, branch] = await Promise.all([
    $`git -C ${cwd} status --porcelain`.text().catch(() => ''),
    currentBranch(cwd),
  ]);

  const files = statusOut
    .trim()
    .split('\n')
    .filter((l) => l.length > 0);

  return {
    dirty: files.length > 0,
    files,
    branch,
  };
}

/** Get current branch name */
export async function currentBranch(cwd: string): Promise<string> {
  return (await $`git -C ${cwd} branch --show-current`.text()).trim();
}

/** List local branches with tracking info */
export async function branches(cwd: string): Promise<BranchInfo[]> {
  const raw = await $`git -C ${cwd} for-each-ref --format=${'%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:trackshort)'} refs/heads`
    .text()
    .catch(() => '');

  return raw
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .map((line) => {
      const [head, name, upstream, trackShort] = line.split('|');
      return {
        name: name.trim(),
        isCurrent: head.trim() === '*',
        upstream: upstream?.trim() || undefined,
        trackingStatus: trackShort?.trim() || undefined,
      };
    });
}

/** Fetch a specific branch from remote */
export async function fetch(cwd: string, remote = 'origin', branch = 'mainline'): Promise<void> {
  await $`git -C ${cwd} fetch -q ${remote} ${branch}`.quiet();
}

/** Rebase onto upstream */
export async function rebase(cwd: string, upstream = 'origin/mainline'): Promise<RebaseResult> {
  try {
    await $`git -C ${cwd} rebase -q ${upstream}`.quiet();
    return { success: true, conflict: false };
  } catch {
    // Check if it's a conflict
    try {
      await $`git -C ${cwd} rebase --abort`.quiet();
    } catch {
      // ignore
    }
    return { success: false, conflict: true };
  }
}

/** Full diff against a base */
export async function diff(cwd: string, base?: string): Promise<string> {
  if (base) {
    return $`git -C ${cwd} diff ${base}`.text().catch(() => '');
  }
  return $`git -C ${cwd} diff`.text().catch(() => '');
}

/** Diff stat (summary) */
export async function diffStat(cwd: string, base?: string): Promise<string> {
  if (base) {
    return $`git -C ${cwd} diff --stat ${base}`.text().catch(() => '');
  }
  return $`git -C ${cwd} diff --stat`.text().catch(() => '');
}

/** Git log */
export async function log(cwd: string, range?: string, format?: string): Promise<string> {
  const fmt = format ?? '--oneline';
  if (range) {
    return $`git -C ${cwd} log ${fmt} ${range}`.text().catch(() => '');
  }
  return $`git -C ${cwd} log ${fmt}`.text().catch(() => '');
}

/** Ahead/behind count relative to upstream */
export async function aheadBehind(
  cwd: string,
  upstream = 'origin/mainline',
): Promise<{ ahead: number; behind: number }> {
  const [ahead, behind] = await Promise.all([
    $`git -C ${cwd} rev-list --count ${upstream}..HEAD`.text().catch(() => '0'),
    $`git -C ${cwd} rev-list --count HEAD..${upstream}`.text().catch(() => '0'),
  ]);

  return {
    ahead: parseInt(ahead.trim(), 10) || 0,
    behind: parseInt(behind.trim(), 10) || 0,
  };
}

/** Check if working tree is clean */
export async function isClean(cwd: string): Promise<boolean> {
  const out = await $`git -C ${cwd} status --porcelain`.text().catch(() => '');
  return out.trim().length === 0;
}

/** Stage all and commit (no-op if nothing to commit) */
export async function commitAll(cwd: string, message: string): Promise<boolean> {
  await $`git -C ${cwd} add -A`.quiet();
  if (await isClean(cwd)) return false;
  await $`git -C ${cwd} commit -q -m ${message}`.quiet();
  return true;
}

/** Amend the last commit with a new message */
export async function amendMessage(cwd: string, message: string): Promise<void> {
  await $`git -C ${cwd} commit -q --amend -m ${message}`.quiet();
}

/** Create a branch (for backups) */
export async function createBranch(cwd: string, name: string): Promise<void> {
  await $`git -C ${cwd} branch ${name}`.quiet();
}

/** Soft reset to a ref */
export async function resetSoft(cwd: string, ref: string): Promise<void> {
  await $`git -C ${cwd} reset --soft ${ref}`.quiet();
}

/** Get rev-list count */
export async function revListCount(cwd: string, range: string): Promise<number> {
  const out = await $`git -C ${cwd} rev-list --count ${range}`.text().catch(() => '0');
  return parseInt(out.trim(), 10) || 0;
}
