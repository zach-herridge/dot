import { c } from '../lib/ui.js';

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

/** Structured finding from AutoSDE for programmatic consumption. */
export interface AutoSdeCrFinding {
  file: string;
  line: number;
  content: string;
  author: string;
  fixed: boolean;
}

export interface MonitorOptions {
  plain?: boolean;
  /** If true, print AutoSDE findings when monitoring finishes with issues. */
  showFindings?: boolean;
}

function isTerminal(status: AnalyzerStatus): boolean {
  // 'Fault' is a terminal infra/config error (e.g. missing destination branch,
  // DRB couldn't start, an analyzer couldn't fetch results). It never resolves
  // on its own, so it must count as terminal or watch polls until timeout.
  return status === 'Pass' || status === 'Fail' || status === 'Fault';
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

/** Fetch full CR revision data. Exported for use by `zh cr` command. */
export async function fetchCr(crId: string, revision?: number): Promise<CrRevisionResponse | null> {
  const rev = revision ?? (await detectLatestRevision(crId));
  return fetchCrRevision(crId, rev);
}

/** Detect the latest revision by trying sequential revision numbers. */
async function detectLatestRevision(crId: string): Promise<number> {
  // Start at 1 and increment until we get a 404 / empty response.
  // Most CRs have <15 revisions so this is fast.
  let latest = 1;
  for (let rev = 2; rev <= 30; rev++) {
    const data = await fetchCrRevision(crId, rev);
    if (!data || !data.revision) break;
    latest = rev;
  }
  return latest;
}

/** Get the latest revision number without fetching full data. */
export async function getLatestRevision(crId: string): Promise<number> {
  return detectLatestRevision(crId);
}

async function fetchCrRevision(crId: string, revision = 1): Promise<CrRevisionResponse | null> {
  const url = `https://code.amazon.com/reviews/${crId}/revisions/${revision}.json`;
  try {
    const proc = Bun.spawn(
      ['mcscli', 'curl', '-s', '-L', url],
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

/**
 * Extract AutoSDE findings from a CR revision response.
 * Returns structured findings for programmatic consumption.
 */
export function extractAutoSdeFindings(data: CrRevisionResponse): AutoSdeCrFinding[] {
  const comments = data.revision?.cr_revision?.comments;
  if (!comments || comments.length === 0) return [];

  const findings: AutoSdeCrFinding[] = [];
  for (const comment of comments) {
    const cm = comment.cr_comment;
    if (!cm) continue;

    // Only AutoSDE comments
    const author = cm.author?.entity_id?.id ?? '';
    if (!author.toLowerCase().includes('autosde') && author !== 'AutoSDE') continue;

    // Location format: "v4:PackageName:path/to/file::lineStart::lineEnd:"
    // or "TOP" for top-level comments
    const loc = cm.location?.comment_location?.location ?? '';
    const { file, line } = parseCommentLocation(loc);

    // Strip metadata prefix lines (e.g., "[//]: # (rule_id=...)")
    const rawContent = cm.content ?? '';
    const content = rawContent
      .split('\n')
      .filter((l) => !l.startsWith('[//]: #'))
      .join('\n')
      .trim();

    findings.push({
      file,
      line,
      content,
      author,
      fixed: cm.fixed ?? false,
    });
  }

  return findings;
}

/**
 * Parse CRUX comment location format.
 * Format: "v4:PackageName:path/to/file::lineStart::lineEnd:"
 * The path comes between "v4:PkgName:" and the first "::" double-colon.
 */
export function parseLocation(loc: string): { file: string; line: number } {
  return parseCommentLocation(loc);
}

function parseCommentLocation(loc: string): { file: string; line: number } {
  if (!loc || loc === 'TOP') return { file: '', line: 0 };

  // Split on first double-colon to separate path from line numbers
  const doubleColonIdx = loc.indexOf('::');
  if (doubleColonIdx === -1) return { file: loc, line: 0 };

  const pathPart = loc.slice(0, doubleColonIdx);
  const linePart = loc.slice(doubleColonIdx + 2);

  // Path format: "v4:PackageName:rest/of/path"
  // Strip the "v4:PackageName:" prefix to get relative file path
  const colonParts = pathPart.split(':');
  // colonParts = ["v4", "PackageName", "path/to/file"]
  const file = colonParts.length >= 3 ? colonParts.slice(2).join(':') : pathPart;

  // Line part: "lineStart::lineEnd:" — take first number
  const lineStr = linePart.split('::')[0] ?? '0';
  const line = parseInt(lineStr, 10) || 0;

  return { file, line };
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
  const showFindings = options?.showFindings ?? true;

  // Detect the latest revision ONCE up front \u2014 watch should monitor the
  // revision that was just uploaded, not always revision 1.
  const revision = await detectLatestRevision(crId);

  if (!plain) {
    console.log(`  ${c.dim(`Monitoring CR analyzers (revision ${revision})...`)}`);
    for (const name of MONITORED_ANALYZERS) {
      console.log(`  ${c.dim('\u25cb')} ${c.dim(name)}  ${c.dim('waiting...')}`);
    }
  } else {
    console.log(`Monitoring ${crId} revision ${revision} analyzers...`);
  }

  const start = Date.now();
  let lastData: CrRevisionResponse | null = null;

  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const data = await fetchCrRevision(crId, revision);
    if (!data?.analyzers) {
      if (plain) console.log(`  [${Math.floor((Date.now() - start) / 1000)}s] fetch failed, retrying...`);
      continue;
    }
    lastData = data;

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

    // Stop early if any analyzer faulted (infra/config error, never self-resolves).
    // Reported distinctly from Fail so the cause (e.g. missing destination branch)
    // is obvious rather than looking like a code finding.
    const faulted = MONITORED_ANALYZERS.filter((name) => {
      const info = statusMap.get(name);
      return info && info.status === 'Fault';
    });

    if (faulted.length > 0) {
      const detail = faulted
        .map((name) => {
          const msg = statusMap.get(name)?.status_message;
          return msg ? `${name}: ${msg}` : name;
        })
        .join('; ');
      if (plain) {
        console.log(`Done: analyzer FAULTED (${Math.floor(elapsed / 1000)}s) — ${detail}`);
        console.log('This is a config/infra error, not a code finding. Common cause: missing destination branch (git branch --set-upstream-to=origin/mainline, then re-run cr).');
      } else {
        console.log();
        console.log(`  ${c.err('Analyzer faulted')} ${c.dim(`(${Math.floor(elapsed / 1000)}s)`)}`);
        console.log(`  ${c.dim(detail)}`);
        console.log(`  ${c.dim('Config/infra error, not a code finding. Common cause: missing destination branch.')}`);
      }
      return;
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

      // Print findings inline when done
      if (showFindings && lastData) {
        const findings = extractAutoSdeFindings(lastData);
        if (findings.length > 0) {
          console.log();
          printAutoSdeFindings(findings, { plain });
        }
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

/**
 * Print AutoSDE findings in a readable format.
 */
export function printAutoSdeFindings(findings: AutoSdeCrFinding[], opts?: { plain?: boolean }): void {
  const active = findings.filter((f) => !f.fixed);
  const fixed = findings.filter((f) => f.fixed);

  if (active.length === 0) {
    console.log(opts?.plain
      ? 'AutoSDE: 0 active findings'
      : `  ${c.ok('AutoSDE: 0 active findings')}${fixed.length > 0 ? c.dim(` (${fixed.length} resolved)`) : ''}`);
    return;
  }

  console.log(opts?.plain
    ? `AutoSDE: ${active.length} active finding(s)${fixed.length > 0 ? ` (${fixed.length} resolved)` : ''}`
    : `  ${c.err(`AutoSDE: ${active.length} active finding(s)`)}${fixed.length > 0 ? c.dim(` (${fixed.length} resolved)`) : ''}`);
  console.log();

  for (const f of active) {
    const loc = `${f.file}${f.line ? `:${f.line}` : ''}`;
    // Skip metadata lines (start with "[//]: #") to get the actual content
    const contentLines = f.content.split('\n');
    const meaningful = contentLines.find((l) => !l.startsWith('[//]: #') && l.trim().length > 0) ?? contentLines[0];
    const summary = meaningful.slice(0, 120);
    if (opts?.plain) {
      console.log(`  ${loc}`);
      console.log(`    ${summary}`);
    } else {
      console.log(`  ${c.warn('W')} ${c.dim(loc)}`);
      console.log(`    ${summary}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
