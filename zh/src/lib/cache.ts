import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Simple JSON file cache with TTL support.
 * Stores cache files in ~/.cache/zh/
 */

const CACHE_DIR = join(homedir(), '.cache', 'zh');

function ensureDir(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Get a cached value. Returns undefined if missing or expired. */
export function get<T>(key: string, ttlMs?: number): T | undefined {
  try {
    const path = join(CACHE_DIR, `${key}.json`);
    const raw = readFileSync(path, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(raw);

    if (ttlMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > ttlMs) return undefined;
    }

    return entry.data;
  } catch {
    return undefined;
  }
}

/** Set a cached value. */
export function set<T>(key: string, data: T): void {
  ensureDir();
  const path = join(CACHE_DIR, `${key}.json`);
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  writeFileSync(path, JSON.stringify(entry, null, 2));
}

/** Invalidate a cached key. */
export function invalidate(key: string): void {
  try {
    const path = join(CACHE_DIR, `${key}.json`);
    require('fs').unlinkSync(path);
  } catch {
    // ignore
  }
}

/** Get cache file age in ms, or Infinity if not cached. */
export function age(key: string): number {
  try {
    const path = join(CACHE_DIR, `${key}.json`);
    const raw = readFileSync(path, 'utf-8');
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp;
  } catch {
    return Infinity;
  }
}
