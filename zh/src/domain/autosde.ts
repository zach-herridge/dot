import { c } from '../lib/ui.js';
import { createSpinner } from 'nanospinner';

/**
 * AutoSDE Shift Left — submit diffs for analysis before CR creation.
 * Uses the production AutoSDE API with Midway auth (mcscli curl).
 */

const API_BASE = 'https://prod.api.autosde.crux.builder-tools.aws.dev';

export interface AutoSdeFinding {
  finding_id: string;
  to_path: string;
  line_number: number;
  category?: string;
  blocking: boolean;
  comment_text: string;
}

export interface AutoSdePackageResult {
  name: string;
  findings: AutoSdeFinding[];
  blockingCount: number;
}

export interface AutoSdeResult {
  runId: string;
  sessionId: string;
  status: 'completed' | 'failed' | 'timed_out';
  error?: { code: string; message: string };
  packages: AutoSdePackageResult[];
  totalFindings: number;
  totalBlocking: number;
  executionTimeMs: number;
}

interface SubmitResponse {
  run_id: string;
  session_id: string;
  status: string;
}

/**
 * Submit diffs for AutoSDE analysis.
 * Returns the run_id and session_id for polling.
 */
export async function submitAnalysis(
  packages: { packageName: string; diff: string }[],
  sessionId?: string,
): Promise<{ runId: string; sessionId: string }> {
  const payload: Record<string, unknown> = {
    packages: packages.map((p) => ({
      package_name: p.packageName,
      diff: p.diff,
    })),
  };
  if (sessionId) {
    payload.session_id = sessionId;
  }

  const body = JSON.stringify(payload);
  const proc = Bun.spawn(
    ['mcscli', 'curl', '-s', '-L', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', body, `${API_BASE}/analyze`],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`mcscli curl failed (exit ${exitCode}). Run mwinit if Midway expired.`);
  }

  const resp = JSON.parse(output) as SubmitResponse;
  if (!resp.run_id) {
    throw new Error(`AutoSDE submit failed: ${output.slice(0, 200)}`);
  }

  return { runId: resp.run_id, sessionId: resp.session_id };
}

/**
 * Poll for analysis results until terminal state.
 */
export async function pollAnalysis(runId: string): Promise<AutoSdeResult> {
  const maxAttempts = 20; // 20 * 15s = 5 min max
  const pollIntervalMs = 15_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const proc = Bun.spawn(
      ['mcscli', 'curl', '-s', '-L', `${API_BASE}/analysis/${runId}`],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    let data: any;
    try {
      data = JSON.parse(output);
    } catch {
      throw new Error(`Failed to parse AutoSDE response: ${output.slice(0, 200)}`);
    }

    const status = data.status as string;
    if (status === 'pending' || status === 'running') {
      await sleep(pollIntervalMs);
      continue;
    }

    // Terminal state
    return parseResult(data);
  }

  throw new Error('AutoSDE analysis timed out (5 min polling limit)');
}

/**
 * Full flow: submit + poll with spinner. Returns result.
 */
export async function runAnalysis(
  packages: { packageName: string; diff: string }[],
  opts?: { plain?: boolean; sessionId?: string },
): Promise<AutoSdeResult> {
  const plain = opts?.plain ?? false;

  // Submit
  const { runId, sessionId } = await submitAnalysis(packages, opts?.sessionId);

  // Poll with progress
  const maxAttempts = 20;
  const pollIntervalMs = 15_000;

  if (!plain) {
    var spinner = createSpinner('AutoSDE analyzing...').start();
  } else {
    console.log('AutoSDE analyzing...');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const proc = Bun.spawn(
      ['mcscli', 'curl', '-s', '-L', `${API_BASE}/analysis/${runId}`],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    let data: any;
    try {
      data = JSON.parse(output);
    } catch {
      if (!plain) spinner!.stop();
      throw new Error(`Failed to parse AutoSDE response: ${output.slice(0, 200)}`);
    }

    const status = data.status as string;
    if (status === 'pending' || status === 'running') {
      if (!plain) {
        spinner!.update({ text: `AutoSDE analyzing... (${(attempt + 1) * 15}s)` });
      }
      await sleep(pollIntervalMs);
      continue;
    }

    // Terminal
    if (!plain) {
      spinner!.stop();
      process.stdout.write('\r\x1b[K');
    }

    const result = parseResult(data);
    result.sessionId = sessionId;
    return result;
  }

  if (!plain) spinner!.stop();
  throw new Error('AutoSDE analysis timed out (5 min polling limit)');
}

/**
 * Print findings in a compact terminal format.
 */
export function printFindings(result: AutoSdeResult): void {
  if (result.error) {
    console.log(c.warn(`  AutoSDE error: ${result.error.code} — ${result.error.message}`));
    return;
  }

  if (result.totalFindings === 0) {
    console.log(`  ${c.ok('AutoSDE: 0 findings')} ${c.dim(`(${formatMs(result.executionTimeMs)})`)}`);
    return;
  }

  const blockLabel = result.totalBlocking > 0
    ? c.err(`${result.totalBlocking} blocking`)
    : c.ok('0 blocking');
  console.log(
    `  AutoSDE: ${result.totalFindings} finding(s), ${blockLabel} ${c.dim(`(${formatMs(result.executionTimeMs)})`)}`,
  );
  console.log();

  for (const pkg of result.packages) {
    if (pkg.findings.length === 0) continue;
    console.log(`  ${c.pkg(pkg.name)}`);
    for (const f of pkg.findings) {
      const icon = f.blocking ? c.err('B') : c.warn('W');
      const loc = f.to_path + (f.line_number ? `:${f.line_number}` : '');
      const text = f.comment_text.split('\n')[0].slice(0, 100);
      console.log(`    ${icon} ${c.dim(loc)}`);
      console.log(`      ${text}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseResult(data: any): AutoSdeResult {
  const packages: AutoSdePackageResult[] = [];

  for (const pkg of data.packages ?? []) {
    const findings: AutoSdeFinding[] = [];

    // Custom rules findings
    for (const rule of pkg.custom_rules?.rules ?? []) {
      for (const f of rule.findings ?? []) {
        findings.push({
          finding_id: f.finding_id,
          to_path: f.to_path ?? '',
          line_number: f.line_number ?? 0,
          category: f.category,
          blocking: f.blocking ?? false,
          comment_text: f.comment_text ?? '',
        });
      }
    }

    // Default reviewer findings
    for (const f of pkg.default_reviewer?.findings ?? []) {
      findings.push({
        finding_id: f.finding_id,
        to_path: f.to_path ?? '',
        line_number: f.line_number ?? 0,
        category: f.category,
        blocking: f.blocking ?? false,
        comment_text: f.comment_text ?? '',
      });
    }

    packages.push({
      name: pkg.name,
      findings,
      blockingCount: findings.filter((f) => f.blocking).length,
    });
  }

  return {
    runId: data.run_id,
    sessionId: data.session_id ?? '',
    status: data.status,
    error: data.error ?? undefined,
    packages,
    totalFindings: data.execution?.total_findings ?? 0,
    totalBlocking: data.execution?.total_blocking_findings ?? 0,
    executionTimeMs: data.execution?.total_execution_time_ms ?? 0,
  };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
