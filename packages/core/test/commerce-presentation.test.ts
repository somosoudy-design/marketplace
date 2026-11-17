import { describe, expect, it } from 'vitest';
import {
  formatOfferPrice,
  presentOfferAvailability,
  quantityControlState,
  sourceDescriptionSections,
  variantAttributeLabel,
  variantDisplayTitle,
} from '../src/commerce-presentation';
import { AVAILABILITY, type Availability } from '../src/availability';
import { D, formatMoney } from '../src/money';
import { describeDispatchStage } from '../src/eta';

describe('explicit offer currency', () => {
  it('keeps decimal arithmetic, local formatting and the USD unit', () => {
    expect(formatOfferPrice(38.6)).toBe('$38,60 USD');
    expect(formatOfferPrice(D('38.60').times(2))).toBe('$77,20 USD');
    expect(formatOfferPrice('1234.565')).toBe('$1.234,57 USD');
    expect(formatOfferPrice(-1.25)).toBe('−$1,25 USD');
    expect(formatMoney(38.6)).toBe('$38,60');
  });
  it.each([null, undefined, ''])('keeps a missing price missing: %s', (value) => {
    expect(formatOfferPrice(value)).toBe('—');
  });
  it('retains the real currency for zero, bolivares and USDT', () => {
    expect(formatOfferPrice(0)).toBe('$0,00 USD');
    expect(formatOfferPrice(124.5, 'VES')).toBe('Bs. 124,50');
    expect(formatOfferPrice(124.5, 'USDT')).toBe('124,50 USDT');
  });
});

describe('commercial variant labels', () => {
  it.each(['Única', ' UNICA ', 'u\u0301nica'])('hides only the technical placeholder %s', (title) => {
    expect(variantDisplayTitle(title)).toBeNull();
  });
  it.each([null, undefined, '', '   '])('omits an absent title: %s', (title) => {
    expect(variantDisplayTitle(title)).toBeNull();
  });
  it.each(['Edición única', 'Unidad única de colección', 'Negro', '128 GB', 'Único'])(
    'retains the meaningful name %s',
    (title) => {
      expect(variantDisplayTitle(title)).toBe(title);
    },
  );
  it('shows declared attributes instead of a technical name without mutating them', () => {
    const options = Object.freeze({ Color: 'Azul', Capacidad: '128 GB', Nota: ' ' });
    expect(variantDisplayTitle('Única', options)).toBe('Azul · 128 GB');
    expect(options.Color).toBe('Azul');
    expect(variantDisplayTitle('Kit completo', options)).toBe('Kit completo');
  });
  it('keeps declared attributes when the variant title is absent', () => {
    expect(variantDisplayTitle('', { Color: 'Azul' })).toBe('Azul');
    expect(variantDisplayTitle(null, { Capacidad: '128 GB' })).toBe('128 GB');
  });
  it('uses explicit attribute names and legacy color metadata', () => {
    expect(variantAttributeLabel(['size', 'color', 'colour'], [])).toBe('Talla / Color');
    expect(variantAttributeLabel([' '], [{ options: { capacity: '128 GB' } }])).toBe('Capacidad');
    expect(variantAttributeLabel(null, [{ color: 'Púrpura' }])).toBe('Color');
    expect(variantAttributeLabel(null, [{ options: {} }])).toBe('Opciones');
    expect(variantAttributeLabel(['Conector'], [{ color: 'Negro' }])).toBe('Conector');
  });
});

describe('quantity control contract', () => {
  it('permits increase from one and stops at the actual maximum', () => {
    expect(quantityControlState(1, 3)).toEqual({ maximum: 3, valid: true, canDecrease: false, canIncrease: true });
    expect(quantityControlState(3, 3)).toEqual({ maximum: 3, valid: true, canDecrease: true, canIncrease: false });
  });
  it('keeps excess visible and allows correction after inventory changes', () => {
    expect(quantityControlState(5, 2)).toEqual({ maximum: 2, valid: false, canDecrease: true, canIncrease: false });
  });
  it.each([0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe quantities %s',
    (quantity) => {
      const state = quantityControlState(quantity, 10);
      expect(state.valid).toBe(false);
      expect(state.canIncrease).toBe(false);
      expect(state.canDecrease).toBe(false);
    },
  );
  it.each([0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'cannot increase against an invalid maximum %s',
    (maximum) => {
      const state = quantityControlState(1, maximum);
      expect(state.maximum).toBe(0);
      expect(state.valid).toBe(false);
      expect(state.canIncrease).toBe(false);
    },
  );
  it('freezes both actions during a write or when the offer is unavailable', () => {
    for (const state of [quantityControlState(2, 4, true, true), quantityControlState(2, 4, false, false)]) {
      expect(state.canIncrease).toBe(false);
      expect(state.canDecrease).toBe(false);
    }
  });
  it('never increments beyond safe integer precision', () => {
    const state = quantityControlState(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(state.valid).toBe(true);
    expect(state.canIncrease).toBe(false);
    expect(state.canDecrease).toBe(true);
  });
});

describe('offer availability and variant stock remain distinct', () => {
  it.each(Object.keys(AVAILABILITY) as Availability[])('retains the real modality for %s', (state) => {
    const result = presentOfferAvailability(state, null);
    expect(result.availabilityLabel).toBe(AVAILABILITY[state].label);
    expect(result.label).toBe(AVAILABILITY[state].label);
    expect(result.purchasable).toBe(AVAILABILITY[state].purchasable);
  });
  it.each(['available', 'on_order', 'in_transit', 'reservable'] as Availability[])(
    'zero stock disables the selection without inventing preorder for %s',
    (state) => {
      const result = presentOfferAvailability(state, 0);
      expect(result.label).toBe('Agotado');
      expect(result.availabilityLabel).toBe(AVAILABILITY[state].label);
      expect(result.purchasable).toBe(false);
    },
  );
  it('a positive stock never reactivates a suspended commercial offer', () => {
    expect(presentOfferAvailability('unavailable', 1).purchasable).toBe(false);
    expect(presentOfferAvailability('unavailable', 1).label).toBe('No disponible');
    expect(presentOfferAvailability('sold_out', 3).purchasable).toBe(false);
  });
  it('unavailable takes priority over the stock of an unavailable option', () => {
    expect(presentOfferAvailability('available', 0, 'unavailable').label).toBe('No disponible');
    expect(presentOfferAvailability('unavailable', 0).label).toBe('No disponible');
  });
  it('does not mutate the shared availability definitions', () => {
    presentOfferAvailability('available', 0);
    expect(AVAILABILITY.available.label).toBe('Disponible');
    expect(AVAILABILITY.available.purchasable).toBe(true);
  });
});

describe('seller-authored content and dispatch source', () => {
  it.each([null, undefined, '', '\n\t\n'])('omits missing description %s', (value) => {
    expect(sourceDescriptionSections(value)).toEqual([]);
  });
  it('structures only explicit headings while retaining the seller statements', () => {
    const description =
      'Descripción original.\r\n\r\nCaracterísticas principales:\r\n• Pinza para celular\r\n\r\nQué incluye la caja\r\n• Trípode con pinza\r\n\r\nEspecificaciones técnicas\r\n• Altura: 1,5 m\r\nProducto original, nuevo y sellado. Entrega estimada: 15 a 23 días.';
    const result = sourceDescriptionSections(description);
    expect(result).toEqual([
      { heading: null, lines: ['Descripción original.'] },
      { heading: 'Características principales', lines: ['• Pinza para celular'] },
      { heading: 'Qué incluye la caja', lines: ['• Trípode con pinza'] },
      {
        heading: 'Especificaciones técnicas',
        lines: ['• Altura: 1,5 m', 'Producto original, nuevo y sellado. Entrega estimada: 15 a 23 días.'],
      },
    ]);
    expect(description).toContain('Entrega estimada: 15 a 23 días.');
  });
  it('keeps arbitrary prose and inline delivery claims as content', () => {
    const input = 'Nuevo\nOferta especial\nEntrega estimada: 15 a 23 días\n<script>alert(1)</script>';
    expect(sourceDescriptionSections(input)).toEqual([{ heading: null, lines: input.split('\n') }]);
  });
  it('keeps dispatch and seller delivery claims as different sources', () => {
    expect(describeDispatchStage('on_order', 5, 10)).toBe('Listo para despacho en 5–10 días (estimado)');
    const sections = sourceDescriptionSections('Entrega estimada: 15 a 23 días.');
    expect(sections[0]?.lines).toEqual(['Entrega estimada: 15 a 23 días.']);
    expect(describeDispatchStage('unavailable', 5, 10)).toBeNull();
  });
});
