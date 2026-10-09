import { describe, expect, it } from 'vitest';
import { convertFromUSD, formatMoney, formatRate, formatUSD, formatVES, roundMoney } from '../src';

describe('money', () => {
  it('formats in es-VE style per currency', () => {
    expect(formatUSD(1234.5)).toBe('$1.234,50');
    expect(formatVES(1234567.891)).toBe('Bs. 1.234.567,89');
    expect(formatMoney(12, 'USDT')).toBe('12,00 USDT');
    expect(formatUSD(42, true)).toBe('$42');
    expect(formatUSD(-3.2)).toBe('−$3,20');
    expect(formatUSD(null)).toBe('—');
  });
  it('rounds half up exactly (no binary float drift)', () => {
    expect(roundMoney('1.005').toFixed(2)).toBe('1.01');
    expect(roundMoney(0.1 + 0.2).toFixed(2)).toBe('0.30');
    expect(roundMoney('2.675').toFixed(2)).toBe('2.68');
  });
  it('converts USD to VES with the quoted rate like the server', () => {
    expect(convertFromUSD('60.00', '36.5312', 'VES').toFixed(2)).toBe('2191.87');
    expect(convertFromUSD('33.33', '1.001', 'USDT').toFixed(2)).toBe('33.36');
  });
  it('formats rates', () => {
    expect(formatRate('36.5312')).toBe('36,53 Bs. por USD');
  });
});
