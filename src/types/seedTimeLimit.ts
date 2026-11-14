export interface SeedTimeLimitRule {
  enabled: boolean;
  tracker: string;
  hours: number;
  includeExisting: boolean;
  revision: string;
}

export type SeedTimeLimitInput = Omit<SeedTimeLimitRule, 'revision'>;

export const DEFAULT_SEED_TIME_LIMIT: SeedTimeLimitRule = {
  enabled: false,
  tracker: '',
  hours: 48,
  includeExisting: false,
  revision: '',
};

export function isSeedTimeLimitRule(value: unknown): value is SeedTimeLimitRule {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'enabled' in value &&
    typeof value.enabled === 'boolean' &&
    'tracker' in value &&
    typeof value.tracker === 'string' &&
    'hours' in value &&
    Number.isSafeInteger(value.hours) &&
    typeof value.hours === 'number' &&
    value.hours > 0 &&
    Number.isSafeInteger(value.hours * 3600) &&
    'includeExisting' in value &&
    typeof value.includeExisting === 'boolean' &&
    'revision' in value &&
    typeof value.revision === 'string'
  );
}

export function isSeedTimeLimitRules(value: unknown): value is SeedTimeLimitRule[] {
  return (
    Array.isArray(value) &&
    value.every(isSeedTimeLimitRule) &&
    new Set(value.map((rule) => rule.tracker)).size === value.length
  );
}
