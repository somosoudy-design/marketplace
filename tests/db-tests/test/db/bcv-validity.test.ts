import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, buy, createStoreWithProduct, createUser, pool } from '../../src/db';

afterAll(() => pool.end());
let buyer: { id: string }, orderId: string;
beforeAll(async () => {
  buyer = await createUser('bcv-buyer');
  const f = await createStoreWithProduct({ kind: 'platform', price: 25 });
  orderId = (await buy(buyer.id, f.variantId, 1)).order_id;
});

// Freeze only these SQL functions inside a rolled-back LOCAL transaction. Calls still go through
// the real buyer RPC, auth checks, obligations, fees, rounding and payment quote persistence.
async function at(time: string, readings: [string, string, number][], fn: (sql: (q: string, p?: unknown[]) => Promise<any[]>) => Promise<void>) {
  const c = await pool.connect();
  const sql = async (q: string, p?: unknown[]) => (await c.query(q, p)).rows;
  try {
    await sql('begin');
    for (const signature of ['public.current_rate(text)', 'public.ingest_rate(text,text,numeric,timestamptz,jsonb,boolean)', 'public.pricing_snapshot_current()']) {
      const [{ def }] = await sql('select pg_get_functiondef($1::regprocedure) as def', [signature]);
      await sql(def.replaceAll('now()', `timestamptz '${time}'`));
    }
    await sql("update public.rate_policies set primary_source='bcv_official', fallback_sources='{dolarapi_oficial}', max_age_minutes=2000, manual_rate=null where pair='USD/VES'");
    await sql("delete from public.exchange_rates where pair='USD/VES'");
    for (const [source, date, rate] of readings) {
      await sql('insert into public.exchange_rates(source_code,pair,rate,observed_at,raw) values ($1,\'USD/VES\',$2,$3,\'{"test":true}\')', [source, rate, date]);
    }
    await fn(sql);
  } finally {
    await c.query('rollback');
    c.release();
  }
}
async function quote(sql: (q: string, p?: unknown[]) => Promise<any[]>, method = 'pago_movil') {
  await sql("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'authenticated', sub: buyer.id })]);
  await sql('set local role authenticated');
  return (await sql('select public.create_payment_quote($1,$2,null) as q', [orderId, method]))[0].q;
}
const friday: [string, string, number] = ['dolarapi_oficial', '2026-10-09T04:00:00Z', 875.6505]; // recorded production observation

describe('BCV effective dates in the real VES buyer quote', () => {
  it.each(['2026-10-10T22:00:00Z', '2026-10-11T22:00:00Z', '2026-10-12T22:00:00Z'])('Friday fallback remains effective on weekend / Oct 12 holiday: %s', async (time) => {
    await at(time, [friday], async (sql) => {
      const q = await quote(sql);
      expect(q).toMatchObject({ currency: 'VES', rate_applied: 875.65, rate_source: 'dolarapi_oficial', amount_due: 21891.25 });
    });
  });
  it('transferencia uses the same current official fallback', async () => {
    await at('2026-10-12T22:00:00Z', [friday], async (sql) => {
      expect(await quote(sql, 'transferencia_ves')).toMatchObject({ currency: 'VES', rate_applied: 875.65, amount_due: 21891.25 });
    });
  });
  it('does not use tomorrow BCV in today quote; selects today fallback', async () => {
    await at('2026-10-14T22:00:00Z', [['bcv_official','2026-10-15T04:00:00Z',880], ['dolarapi_oficial','2026-10-14T04:00:00Z',877.9023]], async (sql) => {
      expect(await quote(sql)).toMatchObject({ rate_source: 'dolarapi_oficial', rate_applied: 877.9, amount_due: 21947.5 });
    });
  });
  it('activates future BCV at Caracas midnight', async () => {
    await at('2026-10-15T04:00:00Z', [['bcv_official','2026-10-15T04:00:00Z',880], ['dolarapi_oficial','2026-10-14T04:00:00Z',877.9023]], async (sql) => {
      expect(await quote(sql)).toMatchObject({ rate_source: 'bcv_official', rate_applied: 880, amount_due: 22000 });
    });
  });
  it('rejects Friday at the next business day, even when fallback has been re-fetched', async () => {
    await at('2026-10-13T04:00:00Z', [friday], async (sql) => {
      await expect(quote(sql)).rejects.toMatchObject({ hint: 'rate_unavailable' });
    });
  });
  it('stores next business date in advance, idempotently, keeping previous active rate', async () => {
    await at('2026-10-09T22:00:00Z', [friday], async (sql) => {
      await sql("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
      const args = ['bcv_official','USD/VES',880,'2026-10-13T04:00:00Z'];
      const call = 'select public.ingest_rate($1,$2,$3,$4) as id';
      const first = (await sql(call,args))[0].id;
      expect((await sql(call,args))[0].id).toBe(first);
      expect(await quote(sql)).toMatchObject({ rate_source:'dolarapi_oficial', rate_applied:875.65 });
    });
  });
  it('ignores a future primary row and finds the current primary row before fallback', async () => {
    await at('2026-10-14T22:00:00Z', [['bcv_official','2026-10-15T04:00:00Z',880], ['bcv_official','2026-10-14T04:00:00Z',877.9023]], async (sql) => {
      expect(await quote(sql)).toMatchObject({ rate_source:'bcv_official', rate_applied:877.9 });
    });
  });
  it('cannot resurrect an obsolete primary ahead of a current fallback', async () => {
    await at('2026-10-13T22:00:00Z', [['bcv_official','2026-10-09T04:00:00Z',875.6505], ['dolarapi_oficial','2026-10-13T04:00:00Z',876.7976]], async (sql) => {
      expect(await quote(sql)).toMatchObject({ rate_source:'dolarapi_oficial', rate_applied:876.8 });
    });
  });
  it.each(['2026-10-14T04:00:00Z', '2026-10-13T05:00:00Z', 'infinity'])('rejects arbitrary future or non-finite ingestion: %s', async (date) => {
    await at('2026-10-09T22:00:00Z', [friday], async (sql) => {
      await sql("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
      await expect(sql('select public.ingest_rate($1,$2,$3,$4)', ['bcv_official','USD/VES',880,date])).rejects.toMatchObject({ code:'22023' });
    });
  });
  it('no calendar for the year: official rates fail closed; identity USD still works', async () => {
    await at('2027-01-04T22:00:00Z', [['bcv_official','2027-01-04T04:00:00Z',880]], async (sql) => {
      expect((await sql("select rate_applied from public.current_rate('USD/USD')"))[0].rate_applied).toBe('1');
      await expect(quote(sql)).rejects.toMatchObject({ hint:'rate_unavailable' });
    });
  });
  it('market rates keep max-age checks and exclude future observations', async () => {
    await at('2026-10-14T22:00:00Z', [], async (sql) => {
      await sql("delete from public.exchange_rates where pair='USD/USDT'");
      await sql("update public.rate_policies set primary_source='kraken_usdt', fallback_sources='{}' where pair='USD/USDT'");
      await sql("insert into public.exchange_rates(source_code,pair,rate,observed_at) values ('kraken_usdt','USD/USDT',1.001,'2026-10-15T04:00:00Z')");
      await expect(sql("select * from public.current_rate('USD/USDT')")).rejects.toMatchObject({ hint:'rate_unavailable' });
    });
  });
  it('calendar is private and banking holidays are the effective transferred dates', async () => {
    expect((await admin("select count(*)::int as n from public.bcv_banking_calendar where not is_business_day and extract(isodow from day)<6"))[0].n).toBe(22);
    const days = await admin("select day::text from public.bcv_banking_calendar where day in ('2026-01-06','2026-01-12','2026-03-19','2026-05-14','2026-05-18','2026-10-12') and is_business_day order by day");
    expect(days.map((d) => d.day)).toEqual(['2026-01-06', '2026-05-14']);
    const [grants] = await admin("select has_function_privilege('anon','public._bcv_business_day(timestamptz)','EXECUTE') as anon, has_function_privilege('authenticated','public._bcv_business_day(timestamptz)','EXECUTE') as buyer");
    expect(grants).toEqual({ anon:false, buyer:false });
  });

  it('a future snapshot does not replace the currently effective snapshot', async () => {
    await at('2026-10-14T22:00:00Z', [], async (sql) => {
      await sql("update public.pricing_snapshots set taken_at='2026-10-13T04:00:00Z', valid_until='2026-10-14T04:00:00Z'");
      const insert = `insert into public.pricing_snapshots(taken_at,valid_until,bcv_rate,bcv_source,bcv_observed_at,usdt_ves_rate,usdt_source,usdt_observed_at,usd_usdt_rate,usd_usdt_source,gap_pct)
        values ($1,'2026-10-16T04:00:00Z',877.9,'dolarapi_oficial','2026-10-14T04:00:00Z',1012,'binance_p2p','2026-10-14T20:00:00Z',1.0011,'kraken_usdt',15.2) returning id`;
      const active = (await sql(insert,['2026-10-14T20:00:00Z']))[0].id;
      await sql(insert,['2026-10-15T04:00:00Z']);
      expect((await sql('select (public.pricing_snapshot_current()).id as id'))[0].id).toBe(active);
    });
  });
  it('midnight UTC still uses the Caracas calendar date', async () => {
    await at('2026-10-13T03:59:59Z', [friday], async (sql) => {
      expect(await quote(sql)).toMatchObject({ rate_applied:875.65 });
    });
  });
  it.each(['2026-10-12', '2026-10-11'])('a missing calendar day cannot silently bridge a holiday or weekend: %s', async (day) => {
    await at('2026-10-12T22:00:00Z', [friday], async (sql) => {
      await sql('delete from public.bcv_banking_calendar where day=$1', [day]);
      await expect(quote(sql)).rejects.toMatchObject({ hint:'rate_unavailable' });
    });
  });

});
