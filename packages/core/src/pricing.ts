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

// ---------------------------------------------------------------------------------------------------------------
// Commercial price engine (docs/PRECIOS.md). The database repeats these calculations and is the one that charges;
// these functions serve the panel's previews and the app's displays, and the tests check both agree.
//
//   landed      = cost (Amazon) + freight (editable; weight × USD/kg by default) + logistics (per unit)
//   divisas     = landed × (1 + margin)                     what we must receive in real dollars (Zelle, USDT)
//   gap         = USDT/VES (P2P) ÷ USD/VES (BCV) − 1        today's snapshot, never negative
//   main (BCV)  = round(divisas × (1 + gap))                the price shown first, in dollars at the BCV rate
//   Pago Móvil  = main × BCV                                bolívares; buys exactly `divisas` USDT on P2P
//   Zelle/USDT  = main × BCV ÷ P2P                          the gap is undone once, never applied twice
// ---------------------------------------------------------------------------------------------------------------

/** Defaults of the engine (setting pricing.import): margin on the landed cost, freight per kg, logistics per unit. */
export interface CostRule {
  markup_pct: number;
  per_kg_usd: number;
  fixed_usd: number;
  round_to: number | null;
}

/** The day's rates the prices are built with (pricing_snapshots). */
export interface GapSnapshot {
  /** bolívares per dollar, official (BCV) */
  bcv: number | string;
  /** bolívares per USDT, market reference (Binance P2P) */
  usdt_ves: number | string;
  /** USDT per real dollar (Kraken); 1 when unknown */
  usd_usdt?: number | string | null;
}

export interface CostInput {
  cost_usd: number | string;
  weight_kg: number | string;
  /** per-unit overrides; null/undefined = the rule's default */
  freight_usd?: number | string | null;
  logistics_usd?: number | string | null;
  margin_pct?: number | string | null;
}

export interface PriceBreakdown {
  cost_usd: string;
  freight_usd: string;
  logistics_usd: string;
  landed_usd: string;
  margin_pct: string;
  margin_usd: string;
  /** what the product must bring in real dollars before rounding */
  target_divisas_usd: string;
  gap_pct: string;
  /** main price, in dollars at the BCV rate, after the rule's rounding */
  price_usd: string;
  /** Pago Móvil / transfer amount in bolívares */
  price_ves: string;
  /** Zelle / USDT amount: price_usd converted back through the gap once */
  price_divisas_usd: string;
  /** how much less Zelle / USDT pays than the main price, in % of it */
  divisas_discount_pct: string;
  /** real-dollar profit at the divisas price, and its share of that price */
  profit_usd: string;
  profit_pct: string;
}

/** Applies a price ending: 41.37 with 0.99 -> 41.99; 41.995 -> 42.99 (never below the computed price). */
export function applyEnding(price: MoneyLike, roundTo: number | null | undefined): string {
  const p = D(price);
  if (roundTo === null || roundTo === undefined) return roundMoney(p).toFixed(2);
  let candidate = p.toDecimalPlaces(0, 1 /* ROUND_DOWN */).plus(roundTo);
  if (candidate.lt(p)) candidate = candidate.plus(1);
  return roundMoney(candidate).toFixed(2);
}
type MoneyLike = number | string | ReturnType<typeof D>;

/** Gap of the snapshot as a fraction (0.159 = 15,9 %); 0 when the market is not above the official rate. */
export function gapOf(s: GapSnapshot): ReturnType<typeof D> {
  const g = D(s.usdt_ves).div(s.bcv).minus(1);
  return g.isNegative() ? D(0) : g;
}

/**
 * Factor that turns an amount in dollars at the BCV rate into what a divisas method collects: USDT for `USDT`,
 * real dollars for `USD` (through USDT per dollar). Multiply by it; the gap is undone exactly once.
 */
export function divisasFactor(s: GapSnapshot, currency: 'USD' | 'USDT' = 'USDT', adjustPct: number | string = 0): ReturnType<typeof D> {
  const gap = gapOf(s);
  const toUsdt = D(1).div(D(1).plus(gap)); // = BCV ÷ P2P, or 1 without gap
  const usdUsdt = D(s.usd_usdt ?? 1);
  const f = currency === 'USD' ? toUsdt.div(usdUsdt) : toUsdt;
  return f.times(D(1).plus(D(adjustPct).div(100)));
}

export function priceFromCost(input: CostInput, rule: CostRule, snapshot: GapSnapshot): PriceBreakdown {
  const cost = D(input.cost_usd);
  if (cost.lte(0)) throw new Error('cost must be positive');
  const freight = roundMoney(input.freight_usd ?? D(input.weight_kg).times(rule.per_kg_usd));
  const logistics = roundMoney(input.logistics_usd ?? rule.fixed_usd);
  const landed = cost.plus(freight).plus(logistics);
  const marginPct = D(input.margin_pct ?? rule.markup_pct);
  const marginUsd = roundMoney(landed.times(marginPct).div(100));
  const target = landed.plus(marginUsd);
  const gap = gapOf(snapshot);
  const price = D(applyEnding(target.times(D(1).plus(gap)), rule.round_to));
  const divisas = roundMoney(price.times(divisasFactor(snapshot, 'USDT')));
  const profit = divisas.minus(landed);
  return {
    cost_usd: roundMoney(cost).toFixed(2),
    freight_usd: freight.toFixed(2),
    logistics_usd: logistics.toFixed(2),
    landed_usd: roundMoney(landed).toFixed(2),
    margin_pct: marginPct.toFixed(2),
    margin_usd: marginUsd.toFixed(2),
    target_divisas_usd: roundMoney(target).toFixed(2),
    gap_pct: gap.times(100).toDecimalPlaces(2).toFixed(2),
    price_usd: price.toFixed(2),
    price_ves: roundMoney(price.times(snapshot.bcv), 'VES').toFixed(2),
    price_divisas_usd: divisas.toFixed(2),
    divisas_discount_pct: price.isZero() ? '0.00' : D(1).minus(divisas.div(price)).times(100).toDecimalPlaces(2).toFixed(2),
    profit_usd: roundMoney(profit).toFixed(2),
    profit_pct: divisas.isZero() ? '0.00' : profit.div(divisas).times(100).toDecimalPlaces(2).toFixed(2),
  };
}
