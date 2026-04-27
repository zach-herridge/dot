import pc from 'picocolors';

/**
 * Minimal UI helpers for consistent terminal output.
 */

export const c = {
  // Semantic colors
  pkg: (s: string) => pc.cyan(s),
  branch: (s: string) => pc.magenta(s),
  ok: (s: string) => pc.green(s),
  warn: (s: string) => pc.yellow(s),
  err: (s: string) => pc.red(s),
  dim: (s: string) => pc.dim(s),
  bold: (s: string) => pc.bold(s),
  header: (s: string) => pc.bold(pc.blue(s)),
};

/** Print a section header */
export function header(text: string): void {
  console.log(c.header(text));
}

/** Print a table with aligned columns */
export function table(rows: string[][], options?: { indent?: number }): void {
  if (rows.length === 0) return;

  const indent = ' '.repeat(options?.indent ?? 2);

  // Calculate column widths (strip ANSI for measurement)
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = Array(colCount).fill(0);

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const stripped = stripAnsi(row[i]);
      widths[i] = Math.max(widths[i], stripped.length);
    }
  }

  for (const row of rows) {
    const cells = row.map((cell, i) => {
      if (i === row.length - 1) return cell; // Don't pad last column
      const stripped = stripAnsi(cell);
      const padding = widths[i] - stripped.length;
      return cell + ' '.repeat(Math.max(0, padding));
    });
    console.log(indent + cells.join('  '));
  }
}

/** Arrow prefix for navigation feedback */
export function nav(text: string): void {
  console.log(`${c.dim('->')} ${text}`);
}

/** Strip ANSI escape codes for width calculation */
function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}

/** Print "nothing to do" style message */
export function empty(text: string): void {
  console.log(c.dim(text));
}

/** Print a horizontal separator */
export function separator(width = 50): void {
  console.log(c.dim('─'.repeat(width)));
}

/** Prompt for text input */
export function prompt(message: string): Promise<string> {
  return new Promise((resolve) => {
    const { createInterface } = require('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Prompt for yes/no confirmation. Defaults to yes (enter = yes). */
export async function confirm(message: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? c.dim('[Y/n]') : c.dim('[y/N]');
  const answer = await prompt(`${message} ${suffix} `);
  const lower = answer.toLowerCase();
  if (defaultYes) return lower !== 'n' && lower !== 'no';
  return lower === 'y' || lower === 'yes';
}

/** Confirm with auto-accept countdown. Resolves to defaultYes if no input within timeoutSec. */
export function confirmWithTimeout(
  message: string,
  timeoutSec = 10,
  defaultYes = true,
): Promise<boolean> {
  return new Promise((resolve) => {
    const { createInterface } = require('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    let remaining = timeoutSec;
    const suffix = defaultYes ? 'Y/n' : 'y/N';
    const autoAction = defaultYes ? 'yes' : 'no';

    function writePrompt(): void {
      process.stdout.write(
        `\r${message} ${c.dim(`[${suffix}]`)} ${c.dim(`(auto-${autoAction} in ${remaining}s)`)} `,
      );
    }

    writePrompt();

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        rl.close();
        // Clear line and show what happened
        process.stdout.write(
          `\r${message} ${c.dim(`[${suffix}]`)} ${c.dim(`auto-${autoAction}`)}\n`,
        );
        resolve(defaultYes);
      } else {
        writePrompt();
      }
    }, 1000);

    rl.question('', (answer: string) => {
      clearInterval(timer);
      rl.close();
      const lower = answer.trim().toLowerCase();
      if (defaultYes) {
        resolve(lower !== 'n' && lower !== 'no');
      } else {
        resolve(lower === 'y' || lower === 'yes');
      }
    });
  });
}

/** Interactive selection via fzf */
export async function fzfSelect(items: string[], opts?: { height?: number }): Promise<string> {
  const height = opts?.height ?? 10;
  const proc = Bun.spawn(['fzf', `--height=${height}`, '--layout=reverse'], {
    stdin: new Blob([items.join('\n')]),
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const output = await new Response(proc.stdout).text();
  const selected = output.trim();
  if (!selected) {
    process.exit(1);
  }
  return selected;
}

/** Interactive multi-selection via fzf (Tab to toggle, Enter to confirm) */
export async function fzfMultiSelect(
  items: string[],
  opts?: { height?: number; header?: string },
): Promise<string[]> {
  const height = opts?.height ?? 15;
  const args = ['fzf', '--multi', `--height=${height}`, '--layout=reverse'];
  if (opts?.header) {
    args.push(`--header=${opts.header}`);
  }
  const proc = Bun.spawn(args, {
    stdin: new Blob([items.join('\n')]),
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return [];
  return output
    .trim()
    .split('\n')
    .filter((l) => l.length > 0);
}

/** 3-way CR prompt with auto-timeout. Returns 'all' | 'select' | 'skip'. */
export function crAction(timeoutSec = 10): Promise<'all' | 'select' | 'skip'> {
  return new Promise((resolve) => {
    const { createInterface } = require('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    let remaining = timeoutSec;

    function promptText(): string {
      return `  Open CR? ${c.bold('a')}ll / ${c.bold('s')}elect / ${c.bold('n')}o ${c.dim(`(auto-all in ${remaining}s)`)} `;
    }

    rl.setPrompt(promptText());
    rl.prompt();

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        rl.close();
        // Clear line and show final state
        process.stdout.write(
          `\r\x1b[K  Open CR? ${c.bold('a')}ll / ${c.bold('s')}elect / ${c.bold('n')}o ${c.dim('auto-all')}\n`,
        );
        resolve('all');
      } else {
        rl.setPrompt(promptText());
        rl.prompt();
      }
    }, 1000);

    rl.on('line', (answer: string) => {
      clearInterval(timer);
      rl.close();
      const lower = answer.trim().toLowerCase();
      if (lower === 's' || lower === 'select') {
        resolve('select');
      } else if (lower === 'n' || lower === 'no') {
        resolve('skip');
      } else {
        resolve('all');
      }
    });
  });
}

/** Format milliseconds as human-readable duration */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
}

/** Format ISO timestamp as relative time ("12m ago", "2h ago", "yesterday") */
export function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
