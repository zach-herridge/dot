import { $ } from 'bun';
import { c, fzfSelect } from '../lib/ui.js';
import * as cache from '../lib/cache.js';

/**
 * AWS credential validation and automatic refresh via ADA.
 *
 * Flow: check STS → if expired, run `ada credentials update` → re-check.
 * Role is auto-discovered per account on first use via `ada credentials list-roles`,
 * then cached forever so subsequent runs are instant.
 */

/** Minimum remaining credential lifetime before we proactively refresh. */
const MIN_REMAINING_MINUTES = 10;

export interface CredentialStatus {
  valid: boolean;
  account?: string;
  arn?: string;
  minutesRemaining?: number;
  error?: string;
}

/** Quick check: are current AWS credentials valid? Also checks remaining lifetime. */
export async function checkCredentials(): Promise<CredentialStatus> {
  try {
    const result = await $`aws sts get-caller-identity --output json`.quiet().text();
    const identity = JSON.parse(result.trim());
    const minutesRemaining = await getCredentialMinutesRemaining();
    return {
      valid: true,
      account: identity.Account,
      arn: identity.Arn,
      minutesRemaining,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Could not validate credentials',
    };
  }
}

/**
 * Get remaining minutes on the current credential by calling ada credentials print.
 * Returns the Expiration field from the JSON output.
 */
async function getCredentialMinutesRemaining(account?: string): Promise<number | undefined> {
  try {
    const role = account ? getCachedRole(account) : undefined;
    if (!account || !role) return undefined;

    const proc = Bun.spawn(
      ['ada', 'credentials', 'print', '--account', account, '--role', role, '--provider', 'conduit'],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return undefined;

    const json = JSON.parse(output.trim());
    if (json.Expiration) {
      const expiry = new Date(json.Expiration);
      return Math.floor((expiry.getTime() - Date.now()) / 60_000);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Refresh credentials via ADA for a specific account.
 * Uses cached role if available, otherwise discovers available roles
 * and lets the user pick (then caches forever).
 */
export async function refreshCredentials(account: string): Promise<boolean> {
  // Check if we have a cached role for this account
  let role = getCachedRole(account);

  if (!role) {
    // Discover available roles for this account
    const roles = await discoverRoles(account);

    if (roles.length === 1) {
      // Only one role -- use it automatically
      role = roles[0];
      console.log(`  ${c.dim('role')}   ${role}`);
    } else if (roles.length > 1) {
      // Multiple roles -- let user pick via fzf
      console.log(c.dim('  select a role for this account:'));
      console.log();
      role = await fzfSelect(roles);
    } else {
      // Couldn't discover roles -- fall back to text prompt
      console.log(c.dim('  ada needs a role for this account.'));
      console.log(c.dim('  (this will be remembered for next time)'));
      console.log();
      const { createInterface } = require('readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      role = await new Promise<string>((resolve) => {
        rl.question(`  ${c.bold('role name')}: `, (ans: string) => {
          rl.close();
          resolve(ans.trim());
        });
      });
    }

    if (!role) return false;

    // Cache on first discovery so we never ask again
    cacheRole(account, role);
  }

  return runAda(account, role);
}

/** Discover available IAM roles for an account via ada. */
async function discoverRoles(account: string): Promise<string[]> {
  try {
    const proc = Bun.spawn(
      ['ada', 'credentials', 'list-roles', '--account', account, '--provider', 'conduit'],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0 && output.trim()) {
      return output.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    }
  } catch {
    // list-roles not available or failed
  }
  return [];
}

/** Run the ada credentials update command. */
async function runAda(account: string, role: string): Promise<boolean> {
  const proc = Bun.spawn(
    ['ada', 'credentials', 'update', '--account', account, '--role', role, '--provider', 'conduit', '--once'],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  return (await proc.exited) === 0;
}

/**
 * Check credentials, auto-refresh if expired OR expiring soon.
 * CDK deploys can take 5+ minutes, so we proactively refresh if
 * less than 10 minutes remain to avoid mid-deploy expiration.
 */
export async function ensureCredentials(targetAccount: string): Promise<CredentialStatus> {
  let creds = await checkCredentials();

  if (creds.valid) {
    // Check remaining lifetime
    const remaining = await getCredentialMinutesRemaining(targetAccount);

    if (remaining !== undefined && remaining < MIN_REMAINING_MINUTES) {
      console.log(
        `  ${c.dim('creds')}  ${c.warn(`${remaining}m remaining`)} ${c.dim('-- refreshing...')}`,
      );
      const refreshed = await refreshCredentials(targetAccount);
      if (refreshed) {
        creds = await checkCredentials();
        console.log(`  ${c.dim('creds')}  ${c.ok('refreshed')} ${c.dim(`(${creds.account})`)}`);
      } else {
        console.log(`  ${c.dim('creds')}  ${c.warn(`${remaining}m remaining -- ada refresh failed`)}`);
      }
      return creds;
    }

    const timeInfo = remaining !== undefined ? ` ${remaining}m` : '';
    console.log(`  ${c.dim('creds')}  ${c.ok('valid')}${c.dim(timeInfo)} ${c.dim(`(${creds.account})`)}`);
    return creds;
  }

  // Credentials expired -- auto-refresh
  console.log(`  ${c.dim('creds')}  ${c.warn('expired')} ${c.dim('-- refreshing via ada...')}`);
  console.log();

  const refreshed = await refreshCredentials(targetAccount);

  if (!refreshed) {
    console.log(`  ${c.dim('creds')}  ${c.err('ada failed')} ${c.dim('-- credentials may not work')}`);
    return { valid: false, error: 'ADA credential refresh failed' };
  }

  // Re-check after refresh
  creds = await checkCredentials();
  if (creds.valid) {
    console.log(`  ${c.dim('creds')}  ${c.ok('refreshed')} ${c.dim(`(${creds.account})`)}`);
  } else {
    console.log(`  ${c.dim('creds')}  ${c.err('still invalid after ada refresh')}`);
  }

  return creds;
}

// ── Role cache (per account, never expires) ────────────────────────────────

const ROLE_CACHE_KEY = 'ada-roles';

function getCachedRole(account: string): string | undefined {
  const roles = cache.get<Record<string, string>>(ROLE_CACHE_KEY);
  return roles?.[account];
}

function cacheRole(account: string, role: string): void {
  const roles = cache.get<Record<string, string>>(ROLE_CACHE_KEY) ?? {};
  roles[account] = role;
  cache.set(ROLE_CACHE_KEY, roles);
}
