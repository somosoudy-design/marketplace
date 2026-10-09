import { describe, expect, it } from 'vitest';
import { AVAILABILITY, computeImportPrice, describeEtaDates, describeLeadTime, stockHint, toAppError, addressSchema, validateUpload } from '../src';

describe('availability', () => {
  it('maps every state to a CTA', () => {
    expect(AVAILABILITY.available.action).toBe('Comprar');
    expect(AVAILABILITY.on_order.action).toBe('Encargar');
    expect(AVAILABILITY.reservable.action).toBe('Reservar');
    expect(AVAILABILITY.in_transit.action).toBe('Reservar');
    expect(AVAILABILITY.sold_out.action).toBe('Avisarme');
    expect(AVAILABILITY.sold_out.purchasable).toBe(false);
  });
  it('only shows low stock when relevant', () => {
    expect(stockHint(2, 'available')).toBe('Quedan 2');
    expect(stockHint(1, 'available')).toBe('Queda 1');
    expect(stockHint(20, 'available')).toBeNull();
    expect(stockHint(2, 'on_order')).toBeNull();
  });
});

describe('eta', () => {
  it('labels estimates as estimates', () => {
    expect(describeEtaDates('2026-10-12', '2026-10-15')).toBe('Llega entre el 12 y el 15 oct (estimado)');
    expect(describeEtaDates('2026-10-30', '2026-11-02')).toBe('Llega entre el 30 oct y el 2 nov (estimado)');
    expect(describeEtaDates('2026-10-12', '2026-10-12')).toBe('Llega el 12 oct (estimado)');
    expect(describeLeadTime(18, 30, 'on_order')).toBe('Llega a Venezuela en 18 a 30 días aprox.');
  });
});

describe('errors', () => {
  it('maps database hints to friendly copy', () => {
    expect(toAppError({ hint: 'rate_unavailable', message: 'x' }).message).toMatch(/tasa/);
    expect(toAppError({ code: '42501', message: 'forbidden' }).code).toBe('forbidden');
    expect(toAppError(new TypeError('Network request failed')).code).toBe('network');
    expect(toAppError({ message: 'weird' }).code).toBe('unknown');
  });
});

describe('import pricing', () => {
  it('computes and rounds commercial price', () => {
    const r = computeImportPrice(40, 0.5, { markup_pct: 30, per_kg_usd: 10, fixed_usd: 2, round_to: 0.99 });
    expect(r).toEqual({ cost_usd: '40.00', markup_usd: '12.00', freight_usd: '5.00', fixed_usd: '2.00', price_usd: '59.99' });
    expect(computeImportPrice(10, 0, { markup_pct: 0, per_kg_usd: 0, fixed_usd: 0, round_to: null }).price_usd).toBe('10.00');
    expect(() => computeImportPrice(0, 1, { markup_pct: 0, per_kg_usd: 0, fixed_usd: 0, round_to: null })).toThrow();
  });
});

describe('validation', () => {
  it('accepts Venezuelan addresses and rejects bad phones/ids', () => {
    const ok = addressSchema.safeParse({ label: 'Casa', recipient: 'Ana Pérez', phone: '0412-123-4567', region_code: 'A', city: 'Caracas', line1: 'Av. Principal, casa 4', id_document: 'V-12345678' });
    expect(ok.success).toBe(true);
    expect(addressSchema.safeParse({ label: 'Casa', recipient: 'Ana', phone: '12', region_code: 'A', city: 'Caracas', line1: 'Av. Principal' }).success).toBe(false);
    expect(addressSchema.safeParse({ label: 'Casa', recipient: 'Ana Pérez', phone: '+58 414 1234567', region_code: 'A', city: 'Caracas', line1: 'Av. Principal 1', id_document: 'X-1' }).success).toBe(false);
  });
  it('validates uploads', () => {
    expect(validateUpload({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateUpload({ type: 'application/x-msdownload', size: 1000 })).toMatch(/Formato/);
    expect(validateUpload({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
