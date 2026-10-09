import { createHmac, generateKeyPairSync, createSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeBinancePayEvent, normalizePaypalEvent, paypalVerifyBody, signBinancePayRequest, verifyBinancePayWebhook } from '../src/payments';
import { detectProvider, extractProductMetadata } from '../src/import';

describe('Binance Pay', () => {
  it('signs requests with HMAC-SHA512 (uppercase hex)', async () => {
    const sig = await signBinancePayRequest('secret', '1700000000000', 'abc', '{"a":1}');
    const expected = createHmac('sha512', 'secret').update('1700000000000\nabc\n{"a":1}\n').digest('hex').toUpperCase();
    expect(sig).toBe(expected);
  });
  it('verifies webhook RSA signatures and rejects tampering', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const body = JSON.stringify({ bizType: 'PAY', bizIdStr: '29383937493038367292', bizStatus: 'PAY_SUCCESS', data: JSON.stringify({ merchantTradeNo: 'PG500100', totalFee: 33.36, currency: 'USDT' }) });
    const signer = createSign('RSA-SHA256'); signer.update(`1700000000\nnonce1\n${body}\n`);
    const signature = signer.sign(privateKey).toString('base64');
    expect(await verifyBinancePayWebhook(pem, { timestamp: '1700000000', nonce: 'nonce1', signature }, body)).toBe(true);
    expect(await verifyBinancePayWebhook(pem, { timestamp: '1700000000', nonce: 'nonce1', signature }, body.replace('33.36', '0.01'))).toBe(false);
    expect(await verifyBinancePayWebhook('not a key', { timestamp: '1', nonce: 'n', signature }, body)).toBe(false);
    const ev = normalizeBinancePayEvent(body);
    expect(ev).toMatchObject({ outcome: 'succeeded', providerPaymentId: 'PG500100', amount: 33.36, currency: 'USDT', eventId: '29383937493038367292' });
  });
});

describe('PayPal', () => {
  it('builds the verification request from headers', () => {
    const b = paypalVerifyBody({ 'paypal-transmission-id': 't1', 'paypal-auth-algo': 'SHA256withRSA' }, 'WH-1', { id: 'E1' });
    expect(b).toMatchObject({ transmission_id: 't1', auth_algo: 'SHA256withRSA', webhook_id: 'WH-1' });
  });
  it('normalizes capture events', () => {
    const ev = normalizePaypalEvent({ id: 'WH-EVT-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP1', amount: { value: '71.50', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'ORDER-9' } } } });
    expect(ev).toMatchObject({ outcome: 'succeeded', providerPaymentId: 'ORDER-9', amount: 71.5, currency: 'USD' });
    expect(normalizePaypalEvent({ id: 'x', event_type: 'CUSTOMER.DISPUTE.CREATED' }).outcome).toBe('ignored');
  });
});

describe('URL import', () => {
  it('identifies providers and their policy', () => {
    expect(detectProvider('https://www.amazon.com/dp/B0TEST').policy).toBe('manual');
    expect(detectProvider('https://us.shein.com/x').policy).toBe('manual');
    expect(detectProvider('https://www.ugreen.com/products/x').policy).toBe('metadata');
    expect(detectProvider('https://shop.example.com/p').key).toBe('generic');
  });
  it('blocks local/private addresses (SSRF)', () => {
    expect(() => detectProvider('http://127.0.0.1:54321/rest/v1')).toThrow();
    expect(() => detectProvider('http://192.168.1.10/')).toThrow();
    expect(() => detectProvider('file:///etc/passwd')).toThrow();
    expect(() => detectProvider('not a url')).toThrow();
  });
  it('extracts JSON-LD product metadata with variants and falls back to Open Graph', () => {
    const html = `<html><head><title>X</title><meta property="og:image" content="/img/og.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Cargador de prueba","description":"Desc","brand":{"@type":"Brand","name":"Marca"},"sku":"SKU1",
      "image":["https://cdn.example.com/a.jpg"],"offers":{"@type":"Offer","price":"39.99","priceCurrency":"USD"},
      "hasVariant":[{"name":"Blanco","sku":"SKU1-W","offers":{"price":"39.99"}},{"name":"Negro","sku":"SKU1-B","offers":{"price":"41.99"}}]}</script></head></html>`;
    const r = extractProductMetadata(html, 'https://shop.example.com/p/1');
    expect(r).toMatchObject({ title: 'Cargador de prueba', brand: 'Marca', price: 39.99, currency: 'USD', sku: 'SKU1' });
    expect(r.images).toEqual(['https://cdn.example.com/a.jpg', 'https://shop.example.com/img/og.jpg']);
    expect(r.variants).toHaveLength(2);
    const og = extractProductMetadata(`<meta property="og:title" content="Solo OG &amp; algo"><meta property="product:price:amount" content="12,50">`, 'https://x.example.com');
    expect(og.title).toBe('Solo OG & algo');
    expect(og.price).toBe(12.5);
  });
});
