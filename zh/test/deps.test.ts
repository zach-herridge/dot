import { describe, expect, test } from 'bun:test';
import { topologicalLevels, expandTargets, type DependencyGraph } from '../src/domain/deps.js';
import type { Package } from '../src/domain/package.js';

// topologicalLevels/expandTargets only read `.name` off a Package, so a minimal
// stub is sufficient — no real workspace or git access needed.
function pkg(name: string): Package {
  return { name } as Package;
}

/** Build a DependencyGraph from a simple { name: [directDeps] } map. */
function graph(edges: Record<string, string[]>): DependencyGraph {
  const edgeMap = new Map<string, Set<string>>();
  for (const [name, deps] of Object.entries(edges)) {
    edgeMap.set(name, new Set(deps));
  }

  // Compute transitive closure from the direct edges.
  const transitive = new Map<string, Set<string>>();
  function collect(name: string, seen: Set<string>): void {
    for (const dep of edgeMap.get(name) ?? []) {
      if (!seen.has(dep)) {
        seen.add(dep);
        collect(dep, seen);
      }
    }
  }
  for (const name of edgeMap.keys()) {
    const seen = new Set<string>();
    collect(name, seen);
    transitive.set(name, seen);
  }

  return { edges: edgeMap, transitive, order: [] };
}

describe('topologicalLevels', () => {
  test('empty input -> no levels', () => {
    expect(topologicalLevels([], graph({}))).toEqual([]);
  });

  test('single target -> one level', () => {
    const levels = topologicalLevels([pkg('A')], graph({ A: [] }));
    expect(levels.map((l) => l.map((p) => p.name))).toEqual([['A']]);
  });

  test('independent targets land in the same level', () => {
    const g = graph({ A: [], B: [] });
    const levels = topologicalLevels([pkg('A'), pkg('B')], g);
    expect(levels).toHaveLength(1);
    expect(new Set(levels[0].map((p) => p.name))).toEqual(new Set(['A', 'B']));
  });

  test('a linear chain produces one package per level, deps first', () => {
    // C depends on B depends on A  =>  [[A],[B],[C]]
    const g = graph({ A: [], B: ['A'], C: ['B'] });
    const levels = topologicalLevels([pkg('A'), pkg('B'), pkg('C')], g);
    expect(levels.map((l) => l.map((p) => p.name))).toEqual([['A'], ['B'], ['C']]);
  });

  test('transitive deps through a non-target still order the targets', () => {
    // UI -> TSClient -> Model, but TSClient is NOT a target.
    // UI must still come after Model.
    const g = graph({ Model: [], TSClient: ['Model'], UI: ['TSClient'] });
    const levels = topologicalLevels([pkg('Model'), pkg('UI')], g);
    expect(levels.map((l) => l.map((p) => p.name))).toEqual([['Model'], ['UI']]);
  });

  test('a dependency cycle is collapsed into a single level (no infinite loop)', () => {
    const g = graph({ A: ['B'], B: ['A'] });
    const levels = topologicalLevels([pkg('A'), pkg('B')], g);
    expect(levels).toHaveLength(1);
    expect(new Set(levels[0].map((p) => p.name))).toEqual(new Set(['A', 'B']));
  });
});

describe('expandTargets', () => {
  test('pulls in an intermediate package on the path between two targets', () => {
    // Targets {Model, UI}; TSClient sits between them and must be included.
    const g = graph({ Model: [], TSClient: ['Model'], UI: ['TSClient'] });
    const expanded = expandTargets(new Set(['Model', 'UI']), g);
    expect(expanded).toEqual(new Set(['Model', 'UI', 'TSClient']));
  });

  test('does not add packages that are not on a path between targets', () => {
    const g = graph({ Model: [], Unrelated: ['Model'], UI: ['Model'] });
    const expanded = expandTargets(new Set(['Model', 'UI']), g);
    expect(expanded).toEqual(new Set(['Model', 'UI']));
  });

  test('leaves a single target unchanged', () => {
    const g = graph({ A: [] });
    expect(expandTargets(new Set(['A']), g)).toEqual(new Set(['A']));
  });
});
