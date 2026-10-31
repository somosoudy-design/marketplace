import { describe, expect, it } from 'vitest';
import { D, applyEnding, divisasFactor, gapOf, priceFromCost } from '../src';

// Rates of 2026-10-09 in the test project: BCV (through DolarApi) 875,65 Bs/$, Binance P2P 1.014,93 Bs/USDT.
const today = { bcv: 875.65, usdt_ves: 1014.93, usd_usdt: 1.0009 };
const rule = { markup_pct: 30, per_kg_usd: 12, fixed_usd: 2.5, round_to: 0.99 };

describe('commercial price engine', () => {
  it('builds the BCV price from the real cost and gives Zelle/USDT the price without the gap', () => {
    // 40 Amazon + 0,5 kg × 12 + 2,50 logistics = 48,50 landed; +30 % = 63,05 to receive in real dollars;
    // gap 15,91 % -> 73,08 -> ending ,99 -> $73,99 BCV; Pago Móvil 73,99 × 875,65; Zelle/USDT 73,99 × 875,65 ÷ 1.014,93
    expect(priceFromCost({ cost_usd: 40, weight_kg: 0.5 }, rule, today)).toEqual({
      cost_usd: '40.00', freight_usd: '6.00', logistics_usd: '2.50', landed_usd: '48.50',
      margin_pct: '30.00', margin_usd: '14.55', target_divisas_usd: '63.05',
      gap_pct: '15.91', price_usd: '73.99', price_ves: '64789.34', price_divisas_usd: '63.84',
      divisas_discount_pct: '13.72', profit_usd: '15.34', profit_pct: '24.03',
    });
  });

  it('never applies the gap twice: Pago Móvil buys exactly the divisas price on P2P, and that is the target', () => {
    for (const cost of [3.5, 12, 40, 199.99, 1250]) {
      for (const p2p of [875.65, 950, 1014.93, 1400]) {
        const s = { bcv: 875.65, usdt_ves: p2p };
        const b = priceFromCost({ cost_usd: cost, weight_kg: 1.2 }, rule, s);
        // bolívares paid by Pago Móvil, converted on P2P, give the same dollars Zelle/USDT pays
        expect(D(b.price_ves).div(p2p).minus(b.price_divisas_usd).abs().lte(0.01)).toBe(true);
        // the divisas price only exceeds the target by the price ending (less than $1 BCV, converted once)
        const over = D(b.price_divisas_usd).minus(b.target_divisas_usd);
        expect(over.gte(-0.01) && over.lte(D(1).div(D(1).plus(gapOf(s))).plus(0.01))).toBe(true);
      }
    }
  });

  it('gives no discount when the market is not above the official rate', () => {
    const b = priceFromCost({ cost_usd: 10, weight_kg: 0 }, { ...rule, per_kg_usd: 0, fixed_usd: 0, markup_pct: 0, round_to: null }, { bcv: 900, usdt_ves: 880 });
    expect([b.gap_pct, b.price_usd, b.price_divisas_usd, b.divisas_discount_pct]).toEqual(['0.00', '10.00', '10.00', '0.00']);
  });

  it('uses the product overrides for freight, logistics and margin', () => {
    const b = priceFromCost({ cost_usd: 20, weight_kg: 3, freight_usd: 4, logistics_usd: 0, margin_pct: 10 }, rule, { bcv: 100, usdt_ves: 100 });
    expect([b.freight_usd, b.logistics_usd, b.landed_usd, b.margin_usd, b.target_divisas_usd, b.price_usd]).toEqual(['4.00', '0.00', '24.00', '2.40', '26.40', '26.99']);
  });

  it('refuses a product without cost', () => {
    expect(() => priceFromCost({ cost_usd: 0, weight_kg: 1 }, rule, today)).toThrow();
  });

  it('converts to real dollars through USDT per dollar and applies a method adjustment', () => {
    expect(divisasFactor(today, 'USDT').toDecimalPlaces(6).toString()).toBe('0.862769');
    expect(divisasFactor(today, 'USD').toDecimalPlaces(6).toString()).toBe('0.861993');
    expect(divisasFactor({ bcv: 100, usdt_ves: 125 }, 'USDT', 2).toString()).toBe('0.816');
  });

  it('applies price endings without going below the computed price', () => {
    expect([applyEnding(41.37, 0.99), applyEnding(41.995, 0.99), applyEnding(42, 0), applyEnding(41.375, null)]).toEqual(['41.99', '42.99', '42.00', '41.38']);
  });
});
