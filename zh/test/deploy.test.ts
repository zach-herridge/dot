import { describe, expect, test } from 'bun:test';
import { parseTarget, fullStackName, matchStack, allStacks } from '../src/domain/deploy.js';
import { getStage, stageDisplayName, allStageNames } from '../src/domain/stages.js';

describe('parseTarget', () => {
  test('splits "<query>@<stage>" on the last @', () => {
    expect(parseTarget('service@beta')).toEqual({ query: 'service', stage: 'beta' });
  });

  test('no @ -> query only, no stage', () => {
    expect(parseTarget('service')).toEqual({ query: 'service' });
  });

  test('a leading @ is not treated as a separator (atIdx must be > 0)', () => {
    expect(parseTarget('@beta')).toEqual({ query: '@beta' });
  });

  test('uses the LAST @ when several are present', () => {
    expect(parseTarget('a@b@gamma')).toEqual({ query: 'a@b', stage: 'gamma' });
  });
});

describe('matchStack', () => {
  test('resolves short aliases', () => {
    expect(matchStack('svc')).toEqual(['Service']);
    expect(matchStack('fr')).toEqual(['FoundationalResources']);
  });

  test('is case-insensitive for exact matches', () => {
    expect(matchStack('SERVICE')).toEqual(['Service']);
  });

  test('falls back to substring matching', () => {
    expect(matchStack('found')).toEqual(['FoundationalResources']);
  });

  test('returns empty for no match', () => {
    expect(matchStack('nonexistent')).toEqual([]);
  });
});

describe('fullStackName / allStacks', () => {
  test('builds the ArccApp-<Stage>-0-<short> form', () => {
    expect(fullStackName('Service', 'beta')).toBe('ArccApp-Beta-0-Service');
  });

  test('allStacks covers every known stack for a stage', () => {
    const stacks = allStacks('devo');
    expect(stacks).toContain('ArccApp-Devo-0-Service');
    expect(stacks).toContain('ArccApp-Devo-0-FoundationalResources');
    expect(stacks).toContain('ArccApp-Devo-0-BuilderToolbox');
  });
});

describe('stages', () => {
  test('getStage is case-insensitive and unknown stages are undefined', () => {
    expect(getStage('PROD')?.confirmLevel).toBe('refuse');
    expect(getStage('devo')?.confirmLevel).toBe('none');
    expect(getStage('nope')).toBeUndefined();
  });

  test('prod is guarded with refuse, gamma with type-name', () => {
    expect(getStage('prod')?.confirmLevel).toBe('refuse');
    expect(getStage('gamma')?.confirmLevel).toBe('type-name');
  });

  test('stageDisplayName capitalizes', () => {
    expect(stageDisplayName('beta')).toBe('Beta');
    expect(stageDisplayName('DEVO')).toBe('Devo');
  });

  test('allStageNames includes the core stages', () => {
    const names = allStageNames();
    for (const s of ['devo', 'beta', 'gamma', 'prod']) {
      expect(names).toContain(s);
    }
  });
});
