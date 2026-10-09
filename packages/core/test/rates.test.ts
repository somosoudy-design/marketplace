import { describe, expect, it } from 'vitest';
import { parseBcvHtml, parseBinanceP2P, parseDolarApi, parseKrakenUsdt, parseLocaleNumber } from '../src/rates';

// Fixture reproduces the structure of the BCV homepage rate block (values are fictitious).
const BCV_FIXTURE = `<div class="view-tipo-de-cambio-oficial-del-bcv">
<div id="euro" class="col-sm-12"><div class="field-content"><div class="row recuadrotsmc"><div class="col-sm-6"><span> EUR </span></div><div class="col-sm-6 centrado"><strong> 41,25000000 </strong></div></div></div></div>
<div id="dolar" class="col-sm-12 col-xs-12 "><div class="field-content"><div class="row recuadrotsmc"><div class="col-sm-6 col-xs-6"><img src="/sites/all/modules/custom/bcv/images/usd.png"> <span> USD </span></div><div class="col-sm-6 col-xs-6 centrado"><strong> 36,53120000 </strong> </div></div></div></div>
<div class="pull-right dinpro center">Fecha Valor: <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-10-09T00:00:00-04:00">Viernes, 09 Octubre  2026</span></div></div>`;

describe('rate adapters', () => {
  it('parses locale numbers', () => {
    expect(parseLocaleNumber('36,53120000')).toBeCloseTo(36.5312);
    expect(parseLocaleNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseLocaleNumber('36.5')).toBeCloseTo(36.5);
    expect(parseLocaleNumber('abc')).toBeNaN();
  });
  it('BCV: reads the USD block (not EUR) and the value date', () => {
    const r = parseBcvHtml(BCV_FIXTURE);
    expect(r.rate).toBeCloseTo(36.5312);
    expect(r.pair).toBe('USD/VES');
    expect(r.observedAt).toBe('2026-10-09T04:00:00.000Z');
  });
  it('BCV: fails loudly when markup changes', () => {
    expect(() => parseBcvHtml('<html>maintenance</html>')).toThrow(/USD block not found/);
  });
  it('DolarApi oficial', () => {
    const r = parseDolarApi({ fuente: 'oficial', nombre: 'Oficial', compra: null, venta: null, promedio: 36.53, fechaActualizacion: '2026-10-09T13:00:00.000Z' });
    expect(r.rate).toBe(36.53);
    expect(() => parseDolarApi({ fuente: 'paralelo', promedio: 40 })).toThrow(/unexpected source/);
    expect(() => parseDolarApi({ promedio: 0 })).toThrow(/implausible/);
  });
  it('Binance P2P: trimmed median, needs enough ads', () => {
    const prices = ['38.1', '38.2', '38.3', '38.4', '38.5', '38.6', '38.7', '90.0', '1.0', '38.45'];
    const r = parseBinanceP2P({ data: prices.map((p) => ({ adv: { price: p } })) }, new Date('2026-10-09T12:00:00Z'));
    expect(r.pair).toBe('USDT/VES');
    expect(r.rate).toBeCloseTo(38.425, 3);
    expect(() => parseBinanceP2P({ data: [{ adv: { price: '1' } }] })).toThrow(/not enough ads/);
  });
  it('Kraken USDT/USD inverted to USD/USDT', () => {
    const r = parseKrakenUsdt({ error: [], result: { USDTZUSD: { c: ['0.99950000', '10'] } } });
    expect(r.rate).toBeCloseTo(1.0005, 4);
    expect(() => parseKrakenUsdt({ error: ['EQuery:Unknown asset pair'] })).toThrow();
    expect(() => parseKrakenUsdt({ error: [], result: { X: { c: ['5', '1'] } } })).toThrow(/implausible/);
  });
});
