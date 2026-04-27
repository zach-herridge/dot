/**
 * ARCC deployment stage configuration.
 * Maps stages to accounts, regions, and safety guardrails.
 */

export interface StageConfig {
  account: string;
  region: string;
  confirmLevel: 'none' | 'prompt' | 'type-name' | 'refuse';
  logGroup: string;
}

export const STAGES: Record<string, StageConfig> = {
  devo: {
    account: '672626785854',
    region: 'us-east-1',
    confirmLevel: 'none',
    logGroup: '/arcc/Devo/lambda/iam',
  },
  beta: {
    account: '187192759204',
    region: 'us-east-1',
    confirmLevel: 'prompt',
    logGroup: '/arcc/Beta/lambda/iam',
  },
  gamma: {
    account: '674428709295',
    region: 'us-east-1',
    confirmLevel: 'type-name',
    logGroup: '/arcc/Gamma/lambda/iam',
  },
  prod: {
    account: '785772043933',
    region: 'us-east-1',
    confirmLevel: 'refuse',
    logGroup: '/arcc/Prod/lambda/iam',
  },
};

export const DEFAULT_STAGE = 'devo';

export const PIPELINE_URL = 'https://pipelines.amazon.com/pipelines/ArccApp';

export function getStage(name: string): StageConfig | undefined {
  return STAGES[name.toLowerCase()];
}

/** "devo" -> "Devo", "beta" -> "Beta" */
export function stageDisplayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function allStageNames(): string[] {
  return Object.keys(STAGES);
}
