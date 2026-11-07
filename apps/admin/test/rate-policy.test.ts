import { describe, expect, it } from 'vitest';
import { ratePolicyPayload } from '../src/lib/rate-policy';
const sources = [
  { code: 'bcv_official', pair: 'USD/VES', enabled: true },
  { code: 'dolarapi_oficial', pair: 'USD/VES', enabled: true },
  { code: 'kraken_usdt', pair: 'USD/USDT', enabled: true },
];
const draft = { primary:'bcv_official', fallbacks:'dolarapi_oficial', margin:'0', maxAge:'4320', rounding:'2' };
describe('rate policy form safeguards', () => {
  it('preserves a valid configured chain and decimal input without recalculating a rate', () => {
    expect(ratePolicyPayload('USD/VES',{...draft,margin:'1,5'},sources)).toEqual({primary_source:'bcv_official',fallback_sources:['dolarapi_oficial'],margin_pct:1.5,max_age_minutes:4320,rounding_decimals:2});
  });
  it('blocks stale state from a different pair even if the select visually falls back to an option', () => {
    expect(()=>ratePolicyPayload('USD/VES',{...draft,primary:'kraken_usdt'},sources)).toThrow('principal compatible');
  });
  it('blocks a fallback for a different pair', () => {
    expect(()=>ratePolicyPayload('USD/VES',{...draft,fallbacks:'kraken_usdt'},sources)).toThrow('Fuentes no compatibles');
  });
  it.each(['bcv_official','dolarapi_oficial, dolarapi_oficial'])('blocks duplicate chain %s',fallbacks=>{
    expect(()=>ratePolicyPayload('USD/VES',{...draft,fallbacks},sources)).toThrow('una sola vez');
  });
  it('allows a temporarily disabled primary with an enabled fallback',()=>{
    expect(ratePolicyPayload('USD/VES',draft,sources.map(s=>({...s,enabled:s.code==='dolarapi_oficial'}))).fallback_sources).toEqual(['dolarapi_oficial']);
  });
  it('blocks a chain with no enabled source',()=>{
    expect(()=>ratePolicyPayload('USD/VES',draft,sources.map(s=>({...s,enabled:false})))).toThrow('Activa al menos');
  });
  it.each(['','0','-3','5.2','Infinity'])('blocks invalid age %s',maxAge=>{
    expect(()=>ratePolicyPayload('USD/VES',{...draft,maxAge},sources)).toThrow('antigüedad');
  });
  it.each(['','1.5','9','-1'])('blocks invalid decimals %s',rounding=>{
    expect(()=>ratePolicyPayload('USD/VES',{...draft,rounding},sources)).toThrow('decimales');
  });
});
