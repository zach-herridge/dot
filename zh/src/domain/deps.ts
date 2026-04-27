import type { Package } from './package.js';

/**
 * Workspace dependency graph, sourced from Brazil's own topo-sorter.
 *
 * brazil-recursive-cmd exposes ${name}, ${dependencies}, and ${alldependencies}
 * as env vars per package. We call it once to get the full graph and build order.
 * This is authoritative -- Brazil reads Config files, resolves through the version
 * set, and handles build-tools vs runtime deps correctly.
 *
 * We store both direct deps (for error propagation -- "skipped because X failed")
 * and transitive deps (for level computation -- UI transitively depends on Model
 * through TypescriptClient, even if TSClient isn't being built).
 */

export interface DependencyGraph {
  /** package name -> set of direct workspace dependency names */
  edges: Map<string, Set<string>>;
  /** package name -> set of ALL transitive workspace dependency names */
  transitive: Map<string, Set<string>>;
  /** packages in topological build order (dependencies first) */
  order: string[];
}

/**
 * Get the workspace dependency graph from Brazil.
 * Caches result for the lifetime of the process.
 */
let cachedGraph: DependencyGraph | null = null;

export async function getDependencyGraph(wsRoot: string): Promise<DependencyGraph> {
  if (cachedGraph) return cachedGraph;

  try {
    cachedGraph = await graphFromBrazil(wsRoot);
  } catch {
    cachedGraph = { edges: new Map(), transitive: new Map(), order: [] };
  }

  return cachedGraph;
}

/**
 * Group targets into build levels using the dependency graph.
 *
 * Level 0: packages with no deps on other targets (build immediately)
 * Level 1: packages whose deps are all in level 0
 * ...etc.
 *
 * Packages within a level can be built in parallel.
 *
 * Uses TRANSITIVE deps so that intermediate non-target packages are
 * accounted for. E.g., if building [Model, UI, Core, CDK] and
 * UI -> TSClient -> Model, UI will correctly wait for Model even
 * though TSClient isn't a target.
 */
export function topologicalLevels(
  targets: Package[],
  graph: DependencyGraph,
): Package[][] {
  if (targets.length <= 1) return targets.length === 1 ? [targets] : [];

  const targetNames = new Set(targets.map((p) => p.name));
  const byName = new Map(targets.map((p) => [p.name, p]));

  // Subgraph: transitive deps filtered to only other targets
  const inDegree = new Map<string, number>();
  const localDeps = new Map<string, Set<string>>();

  for (const name of targetNames) {
    const allDeps = graph.transitive.get(name) ?? new Set();
    const filtered = new Set([...allDeps].filter((d) => targetNames.has(d)));
    localDeps.set(name, filtered);
    inDegree.set(name, filtered.size);
  }

  const levels: Package[][] = [];

  while (inDegree.size > 0) {
    const ready: string[] = [];
    for (const [name, deg] of inDegree) {
      if (deg === 0) ready.push(name);
    }

    if (ready.length === 0) {
      // Cycle -- dump everything into one level
      levels.push([...inDegree.keys()].map((n) => byName.get(n)!));
      break;
    }

    levels.push(ready.map((n) => byName.get(n)!));

    for (const name of ready) {
      inDegree.delete(name);
    }
    for (const [other, deps] of localDeps) {
      if (!inDegree.has(other)) continue;
      for (const name of ready) {
        if (deps.has(name)) {
          deps.delete(name);
          inDegree.set(other, (inDegree.get(other) ?? 1) - 1);
        }
      }
    }
  }

  return levels;
}

/**
 * Expand a set of target names to include intermediate workspace packages
 * that sit on dependency paths between targets.
 *
 * Example: targets = {Model, UI, Core, CDK}
 *   UI depends on TSClient, TSClient depends on Model.
 *   TSClient is NOT dirty, but it sits between Model and UI.
 *   If Model changed, TSClient must rebuild so UI gets the new generated code.
 *
 * Algorithm: for each target T, look at T's transitive deps. If any dep D
 * (a workspace package, not already a target) itself transitively depends on
 * a target, then D is on a dependency path and must be included.
 * Repeat until stable.
 */
export function expandTargets(targetNames: Set<string>, graph: DependencyGraph): Set<string> {
  const expanded = new Set(targetNames);
  let changed = true;

  while (changed) {
    changed = false;
    for (const target of [...expanded]) {
      const deps = graph.transitive.get(target) ?? new Set();
      for (const dep of deps) {
        if (expanded.has(dep)) continue;
        if (!graph.edges.has(dep)) continue; // not a workspace package

        // Does this dep transitively depend on any target?
        const depTransitive = graph.transitive.get(dep) ?? new Set();
        const dependsOnTarget = [...expanded].some((t) => depTransitive.has(t));
        if (dependsOnTarget) {
          expanded.add(dep);
          changed = true;
        }
      }
    }
  }

  return expanded;
}

// ── Brazil Graph ──────────────────────────────────────────────────────────

/**
 * Call brazil-recursive-cmd to get the full dependency graph.
 *
 * Each package gets ${name}, ${dependencies}, ${alldependencies} env vars.
 * Output: "PKG_NAME|DIRECT_DEPS|ALL_DEPS"
 *
 * We need both:
 *   - direct deps: for "skipped because X failed" messages
 *   - transitive deps: for correct level ordering when intermediate
 *     packages aren't in the target set
 */
async function graphFromBrazil(wsRoot: string): Promise<DependencyGraph> {
  const proc = Bun.spawn(
    [
      'brazil-recursive-cmd',
      '--allPackages',
      'echo "${name}|${dependencies}|${alldependencies}"',
    ],
    {
      cwd: wsRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error('brazil-recursive-cmd failed');
  }

  const edges = new Map<string, Set<string>>();
  const transitive = new Map<string, Set<string>>();
  const order: string[] = [];

  for (const line of stdout.split('\n')) {
    // "ARCCAppUi|ARCC-1.0,ARCCAppClientConfig-1.0,ARCCAppTypescriptClient-1.0|ARCC-1.0,...,ARCCAppModel-1.0"
    const parts = line.split('|');
    if (parts.length < 3) continue;

    const pkgName = parts[0].trim();
    if (!pkgName) continue;

    order.push(pkgName);
    edges.set(pkgName, parseDeps(parts[1]));
    transitive.set(pkgName, parseDeps(parts[2]));
  }

  return { edges, transitive, order };
}

/** Parse "Pkg1-1.0,Pkg2-1.0" into Set<"Pkg1", "Pkg2"> */
function parseDeps(raw: string): Set<string> {
  const deps = new Set<string>();
  const trimmed = raw.trim();
  if (!trimmed) return deps;

  for (const dep of trimmed.split(',')) {
    // Strip "-1.0" interface suffix
    const name = dep.replace(/-\d+\.\d+$/, '');
    if (name) deps.add(name);
  }
  return deps;
}
