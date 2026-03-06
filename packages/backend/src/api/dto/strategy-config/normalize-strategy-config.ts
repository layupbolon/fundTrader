import { InvestFrequency, StrategyType } from '../../../models';

function normalizeAutoInvestFrequency(config: Record<string, any>): Record<string, any> {
  const normalized = { ...config };

  if (!normalized.frequency) {
    if (normalized.day_of_month !== undefined) {
      normalized.frequency = InvestFrequency.MONTHLY;
    } else if (normalized.day_of_week !== undefined) {
      normalized.frequency = InvestFrequency.WEEKLY;
    } else {
      normalized.frequency = InvestFrequency.WEEKLY;
    }
  }

  return normalized;
}

export function normalizeStrategyConfig(
  type: StrategyType,
  config: Record<string, any>,
): Record<string, any> {
  if (!config || typeof config !== 'object') {
    return config;
  }

  switch (type) {
    case StrategyType.AUTO_INVEST:
      return normalizeAutoInvestFrequency(config);
    default:
      return config;
  }
}
