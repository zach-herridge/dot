import { $ } from 'bun';
import type { Package } from './package.js';
import type { Workspace } from './workspace.js';
import { stageDisplayName } from './stages.js';
import * as cache from '../lib/cache.js';

/**
 * Deploy target resolution, stack matching, and deploy ledger.
 */

// -- Known stacks & aliases --

const KNOWN_STACKS = ['Service', 'FoundationalResources', 'BuilderToolbox'];

const SHORT_ALIASES: Record<string, string> = {
  svc: 'Service',
  fr: 'FoundationalResources',
};

// -- Target parsing --

export interface ParsedTarget {
  query: string;
  stage?: string;
}

/** Parse "service@beta" -> { query: "service", stage: "beta" } */
export function parseTarget(input: string): ParsedTarget {
  const atIdx = input.lastIndexOf('@');
  if (atIdx > 0) {
    return {
      query: input.slice(0, atIdx),
      stage: input.slice(atIdx + 1),
    };
  }
  return { query: input };
}

// -- Stack resolution --

/** Generate full stack name from short name and stage. */
export function fullStackName(shortName: string, stage: string): string {
  return `ArccApp-${stageDisplayName(stage)}-0-${shortName}`;
}

/**
 * Fuzzy-match a query against known stack short names.
 * Returns matching short names.
 */
export function matchStack(query: string): string[] {
  const lower = query.toLowerCase();

  // Check aliases first
  const aliased = SHORT_ALIASES[lower];
  if (aliased) return [aliased];

  // Exact match
  const exact = KNOWN_STACKS.filter((s) => s.toLowerCase() === lower);
  if (exact.length > 0) return exact;

  // Substring match
  return KNOWN_STACKS.filter((s) => s.toLowerCase().includes(lower));
}

/** Get all known stack names for a stage. */
export function allStacks(stage: string): string[] {
  return KNOWN_STACKS.map((s) => fullStackName(s, stage));
}

// -- Deploy ledger --

export interface DeployRecord {
  stack: string;
  stage: string;
  timestamp: string;
  durationMs: number;
  hotswap: boolean;
  shas: Record<string, string>;
}

const LEDGER_KEY = 'deploy-ledger';

export function getHistory(): DeployRecord[] {
  return cache.get<DeployRecord[]>(LEDGER_KEY) ?? [];
}

export function getLastDeploy(): DeployRecord | undefined {
  const history = getHistory();
  return history.length > 0 ? history[0] : undefined;
}

export function recordDeploy(record: DeployRecord): void {
  const history = getHistory();
  history.unshift(record);
  cache.set(LEDGER_KEY, history.slice(0, 50));
}

// -- SHA tracking --

/** Get current HEAD SHA for every package in the workspace. */
export async function getPackageShas(ws: Workspace): Promise<Record<string, string>> {
  const packages = await ws.packages();
  const shas: Record<string, string> = {};

  await Promise.all(
    packages.map(async (pkg) => {
      try {
        const sha = (await $`git -C ${pkg.path} rev-parse --short HEAD`.quiet().text()).trim();
        shas[pkg.name] = sha;
      } catch {
        shas[pkg.name] = 'unknown';
      }
    }),
  );

  return shas;
}

/** Find packages whose SHA differs from a recorded set. */
export async function getChangedPackages(
  ws: Workspace,
  recordedShas: Record<string, string>,
): Promise<string[]> {
  const currentShas = await getPackageShas(ws);
  const changed: string[] = [];

  for (const [name, sha] of Object.entries(currentShas)) {
    if (!recordedShas[name] || recordedShas[name] !== sha) {
      changed.push(name);
    }
  }

  return changed;
}
