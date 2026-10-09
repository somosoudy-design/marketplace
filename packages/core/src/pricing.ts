import { D, roundMoney } from './money';

export interface ImportPricingRule {
  markup_pct: number;
  per_kg_usd: number;
  fixed_usd: number;
  /** final cents, e.g. 0.99 => 41.99; null to keep exact */
  round_to: number | null;
  configured?: boolean;
}

export interface ImportPriceBreakdown {
  cost_usd: string;
  markup_usd: string;
  freight_usd: string;
  fixed_usd: string;
  price_usd: string;
}

/**
 * Commercial price for an imported product: cost + markup + freight by weight + fixed handling,
 * then psychological rounding. Used by the admin URL importer (editable before publishing).
 */
export function computeImportPrice(costUsd: number | string, weightKg: number | string, rule: ImportPricingRule): ImportPriceBreakdown {
  const cost = D(costUsd);
  if (cost.lte(0)) throw new Error('cost must be positive');
  const markup = roundMoney(cost.times(rule.markup_pct).div(100));
  const freight = roundMoney(D(weightKg).times(rule.per_kg_usd));
  const fixed = roundMoney(rule.fixed_usd);
  let price = cost.plus(markup).plus(freight).plus(fixed);
  if (rule.round_to !== null && rule.round_to !== undefined) {
    const whole = price.toDecimalPlaces(0, 1 /* ROUND_DOWN */);
    let candidate = whole.plus(rule.round_to);
    if (candidate.lt(price)) candidate = candidate.plus(1);
    price = candidate;
  }
  return {
    cost_usd: cost.toFixed(2), markup_usd: markup.toFixed(2), freight_usd: freight.toFixed(2),
    fixed_usd: fixed.toFixed(2), price_usd: roundMoney(price).toFixed(2),
  };
}
