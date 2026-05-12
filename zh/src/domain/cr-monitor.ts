import { c } from '../lib/ui.js';
import * as cache from '../lib/cache.js';

const LAST_CR_KEY = 'last-cr';

/**
 * Monitor CR analyzer status by polling the revision JSON endpoint.
 * Watches "Dry Run Build" and "AutoSDE - CR reviewer" until both reach a terminal state.
 */

const MONITORED_ANALYZERS = ['Dry Run Build', 'AutoSDE - CR reviewer'];
const POLL_INTERVAL_MS = 20_000; // 20 seconds
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

type AnalyzerStatus = 'Pass' | 'Fail' | 'Working' | 'Scheduled' | 'Blocked' | string;

export interface AnalyzerInfo {
  partner_id: string;
  status: AnalyzerStatus;
  status_message: string | null;
}

export interface CrComment {
  cr_comment?: {
    location?: {
      comment_location?: {
        cr: string;
        revision: number;
        location: string;
        post: number;
      };
    };
    author?: {
      entity_id?: {
        type: string;
        id: string;
      };
    };
    content?: string;
    importance?: number;
    fixed?: boolean;
    created_at?: string;
  };
}

export interface CrRevisionResponse {
  analyzers?: AnalyzerInfo[];
  revision?: {
    cr_revision?: {
      status?: string;
      summary?: string;
      comments?: CrComment[];
      approved_by?: string[];
    };
  };
}

export interface MonitorOptions {
  plain?: boolean;
}

function isTerminal(status: AnalyzerStatus): boolean {
  return status === 'Pass' || status === 'Fail';
}

/** AutoSDE reports "Pass" even with comments. We treat comments as a failure. */
function autoSdeCommentCount(info: AnalyzerInfo): number {
  if (info.partner_id !== 'AutoSDE - CR reviewer') return 0;
  if (!info.status_message) return 0;
  const match = info.status_message.match(/(\d+) comment/);
  return match ? parseInt(match[1], 10) : 0;
}

function hasAutoSdeComments(info: AnalyzerInfo): boolean {
  return autoSdeCommentCount(info) > 0;
}

/** Get effective status -- AutoSDE with comments is treated as Fail. */
function effectiveStatus(info: AnalyzerInfo): AnalyzerStatus {
  if (hasAutoSdeComments(info)) return 'Fail';
  return info.status;
}

function statusIcon(status: AnalyzerStatus): string {
  switch (status) {
    case 'Pass':
      return c.ok('\u2713');
    case 'Fail':
      return c.err('\u2717');
    case 'Working':
      return c.warn('\u25cb');
    case 'Scheduled':
      return c.dim('\u25cb');
    case 'Blocked':
      return c.dim('\u25a1');
    default:
      return c.dim('?');
  }
}

function statusColor(status: AnalyzerStatus, text: string): string {
  switch (status) {
    case 'Pass':
      return c.ok(text);
    case 'Fail':
      return c.err(text);
    case 'Working':
      return c.warn(text);
    default:
      return c.dim(text);
  }
}

/** Save last CR ID to cache (called by prep after CR creation). */
export function saveLastCr(crId: string): void {
  cache.set(LAST_CR_KEY, crId);
}

/** Get last CR ID from cache. */
export function getLastCr(): string | undefined {
  return cache.get<string>(LAST_CR_KEY);
}

/** Fetch full CR revision data. Exported for use by `zh cr` command. */
export async function fetchCr(crId: string, revision = 1): Promise<CrRevisionResponse | null> {
  return fetchCrRevision(crId, revision);
}

async function fetchCrRevision(crId: string, revision = 1): Promise<CrRevisionResponse | null> {
  const url = `https://code.amazon.com/reviews/${crId}/revisions/${revision}.json`;
  try {
    const proc = Bun.spawn(
      ['curl', '-s', '-L', '-b', `${process.env.HOME}/.midway/cookie`, url],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return null;
    return JSON.parse(output) as CrRevisionResponse;
  } catch {
    return null;
  }
}

function renderStatus(analyzers: Map<string, AnalyzerInfo>, elapsed: number): void {
  const lines: string[] = [];
  for (const name of MONITORED_ANALYZERS) {
    const info = analyzers.get(name);
    if (!info) {
      lines.push(`  ${c.dim('\u25cb')} ${c.dim(name)}  ${c.dim('not found')}`);
      continue;
    }
    const eff = effectiveStatus(info);
    const icon = statusIcon(eff);
    const commentCount = autoSdeCommentCount(info);
    const label = commentCount > 0 ? `Fail (${commentCount} comments)` : info.status;
    const status = statusColor(eff, label);
    lines.push(`  ${icon} ${name}  ${status}`);
  }
  const timeStr = c.dim(`(${Math.floor(elapsed / 1000)}s)`);

  // Move cursor up to overwrite previous status lines, then rewrite
  process.stdout.write(`\x1b[${MONITORED_ANALYZERS.length + 1}A\x1b[J`);
  console.log(`  ${c.dim('Monitoring CR analyzers...')} ${timeStr}`);
  for (const line of lines) {
    console.log(line);
  }
}

function renderStatusPlain(analyzers: Map<string, AnalyzerInfo>, elapsed: number): void {
  const parts: string[] = [];
  for (const name of MONITORED_ANALYZERS) {
    const info = analyzers.get(name);
    if (!info) {
      parts.push(`${name}: unknown`);
      continue;
    }
    const commentCount = autoSdeCommentCount(info);
    const label = commentCount > 0 ? `Fail (${commentCount} comments)` : info.status;
    parts.push(`${name}: ${label}`);
  }
  console.log(`  [${Math.floor(elapsed / 1000)}s] ${parts.join(' | ')}`);
}

export async function monitorCr(crId: string, options?: MonitorOptions): Promise<void> {
  const plain = options?.plain ?? false;

  if (!plain) {
    console.log(`  ${c.dim('Monitoring CR analyzers...')}`);
    for (const name of MONITORED_ANALYZERS) {
      console.log(`  ${c.dim('\u25cb')} ${c.dim(name)}  ${c.dim('waiting...')}`);
    }
  } else {
    console.log(`Monitoring ${crId} analyzers...`);
  }

  const start = Date.now();

  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const data = await fetchCrRevision(crId);
    if (!data?.analyzers) {
      if (plain) console.log(`  [${Math.floor((Date.now() - start) / 1000)}s] fetch failed, retrying...`);
      continue;
    }

    // Build status map for monitored analyzers
    const statusMap = new Map<string, AnalyzerInfo>();
    for (const a of data.analyzers) {
      if (MONITORED_ANALYZERS.includes(a.partner_id)) {
        statusMap.set(a.partner_id, a);
      }
    }

    const elapsed = Date.now() - start;

    if (plain) {
      renderStatusPlain(statusMap, elapsed);
    } else {
      renderStatus(statusMap, elapsed);
    }

    // Stop early if any analyzer failed
    const anyFailed = MONITORED_ANALYZERS.some((name) => {
      const info = statusMap.get(name);
      return info && effectiveStatus(info) === 'Fail';
    });

    if (anyFailed) {
      if (plain) {
        console.log(`Done: analyzers finished with issues (${Math.floor(elapsed / 1000)}s)`);
      } else {
        console.log();
        console.log(`  ${c.warn('Analyzers finished with issues')} ${c.dim(`(${Math.floor(elapsed / 1000)}s)`)}`);
      }
      return;
    }

    // Check if all monitored analyzers passed
    const allPassed = MONITORED_ANALYZERS.every((name) => {
      const info = statusMap.get(name);
      return info && isTerminal(info.status) && effectiveStatus(info) === 'Pass';
    });

    if (allPassed) {
      if (plain) {
        console.log(`Done: all monitored analyzers passed (${Math.floor(elapsed / 1000)}s)`);
      } else {
        console.log();
        console.log(`  ${c.ok('All monitored analyzers passed')} ${c.dim(`(${Math.floor(elapsed / 1000)}s)`)}`);
      }
      return;
    }
  }

  // Timed out
  const elapsed = Math.floor((Date.now() - start) / 1000);
  if (plain) {
    console.log(`Timed out waiting for analyzers (${elapsed}s)`);
  } else {
    console.log();
    console.log(`  ${c.warn('Timed out waiting for analyzers')} ${c.dim(`(${elapsed}s)`)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
