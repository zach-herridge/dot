import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Append-only session log for AutoSDE runs.
 * Stored as newline-delimited JSON in ~/.cache/zh/autosde-sessions.jsonl
 * Claude can look these up if it forgets a session ID.
 */

const LOG_PATH = join(homedir(), '.cache', 'zh', 'autosde-sessions.jsonl');

export interface SessionEntry {
  sessionId: string;
  runId: string;
  workspace: string;
  branch: string;
  packages: string[];
  findings: number;
  blocking: number;
  status: string;
  timestamp: number;
}

export function log(entry: Omit<SessionEntry, 'timestamp'>): void {
  mkdirSync(join(homedir(), '.cache', 'zh'), { recursive: true });
  const line = JSON.stringify({ ...entry, timestamp: Date.now() }) + '\n';
  appendFileSync(LOG_PATH, line);
}

export function list(limit = 10): SessionEntry[] {
  try {
    const raw = readFileSync(LOG_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines
      .map((l) => JSON.parse(l) as SessionEntry)
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}
