import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, pool, type Fixture } from '../../src/db';

afterAll(() => pool.end());
const ask = (u: string, product: string, body: string) => asUser(u, async sql => (await sql('select public.ask_question($1,$2) as q', [product, body]))[0].q);
const list = (u: string | null, product: string) => asUser(u, async sql => (await sql('select public.product_questions($1,10,0) as q', [product]))[0].q);
const answer = (u: string, id: string, body: string) => asUser(u, async sql => (await sql('select public.answer_question($1,$2) as q', [id, body]))[0].q);
const moderate = (u: string, id: string, hide: boolean, reason: string | null = null) => asUser(u, async sql => (await sql('select public.moderate_question($1,$2,$3) as q', [id, hide, reason]))[0].q);

describe('product questions authorization and moderation', () => {
  let buyer: { id: string }, other: { id: string }, seller: { id: string }, mod: { id: string }, f: Fixture;
  beforeAll(async () => {
    const [where] = await admin('select current_database() as db, host(inet_server_addr()) as host');
    if (where.db !== 'kora_test' || where.host !== '127.0.0.1') throw new Error('Questions fixtures require the isolated local kora_test clone');
    buyer = await createUser('question-buyer'); other = await createUser('question-other');
    seller = await createUser('question-seller'); mod = await createUser('question-admin', { role: 'admin' });
    f = await createStoreWithProduct({ owner: seller.id });
  });
  it('keeps unanswered questions private, derives capabilities, and never exposes actor identifiers', async () => {
    const q = await ask(buyer.id, f.productId, '¿Incluye todos los accesorios?');
    expect(q).toMatchObject({ mine: true, status: 'published', answer_body: null });
    expect(q).not.toHaveProperty('user_id'); expect(q).not.toHaveProperty('answered_by');
    expect(await list(null, f.productId)).toMatchObject({ count: 0, can_ask: false, can_answer: false, can_moderate: false });
    expect(await list(other.id, f.productId)).toMatchObject({ count: 0, can_ask: true, can_answer: false });
    expect(await list(buyer.id, f.productId)).toMatchObject({ count: 1, can_answer: false });
    expect(await list(seller.id, f.productId)).toMatchObject({ count: 1, can_answer: true, can_moderate: false });
    expect(await list(mod.id, f.productId)).toMatchObject({ count: 1, can_answer: true, can_moderate: true });
    await expect(asUser(null, sql => sql('select public.ask_question($1,$2)', [f.productId, 'Pregunta sin usuario']))).rejects.toMatchObject({ code: '42501' });
  });
  it('deduplicates normalized retries without notifications or republication', async () => {
    const a = await ask(other.id, f.productId, '¿Incluye el cable?');
    const b = await ask(other.id, f.productId, '  ¿Incluye   el cable?  ');
    expect(a.id).toBe(b.id);
    expect((await admin("select count(*)::int as n from public.notifications where user_id=$1 and data->>'question_id'=$2", [seller.id, a.id]))[0].n).toBe(1);
    await moderate(mod.id, a.id, true, 'Revisión de contenido');
    expect((await ask(other.id, f.productId, '¿Incluye el cable?')).status).toBe('hidden');
  });
  it('validates lengths and rejects public contact details', async () => {
    for (const text of ['corto', 'x'.repeat(501)]) await expectHint(ask(buyer.id, f.productId, text), 'invalid_input');
    for (const text of ['Escribe a a@example.com', 'Visita https://example.com', 'Revisa www.example.com', 'Llama al +58 (412) 123-4567']) await expectHint(ask(buyer.id, f.productId, text), 'question_contact');
  });
  it('requires the actual store to answer and admin to moderate; hidden replies remain hidden', async () => {
    const q = await ask(buyer.id, f.productId, '¿Cuál es el material principal?');
    await expectHint(answer(other.id, q.id, 'Un material'), 'store_access_denied');
    await answer(seller.id, q.id, 'Está fabricado en aluminio.');
    expect((await list(null, f.productId)).items.some((x: { id: string }) => x.id === q.id)).toBe(true);
    await expectHint(moderate(seller.id, q.id, true, 'No me gusta'), 'admin_required');
    await expectHint(moderate(mod.id, q.id, true, ' '), 'invalid_input');
    await moderate(mod.id, q.id, true, 'Datos por revisar');
    await answer(seller.id, q.id, 'Está fabricado en una aleación de aluminio.');
    expect((await list(null, f.productId)).items.some((x: { id: string }) => x.id === q.id)).toBe(false);
    expect((await list(buyer.id, f.productId)).items.find((x: { id: string }) => x.id === q.id)).toMatchObject({ status: 'hidden', hidden_reason: 'Datos por revisar' });
    await moderate(mod.id, q.id, false);
    expect((await list(null, f.productId)).items.some((x: { id: string }) => x.id === q.id)).toBe(true);
  });
  it('limits new questions per actor and keeps a retry usable at the cap', async () => {
    const u = await createUser('question-rate');
    const first = await ask(u.id, f.productId, '¿Cuál es el tamaño número 0?');
    for (let i = 1; i < 5; i++) await ask(u.id, f.productId, `¿Cuál es el tamaño número ${i}?`);
    await expectHint(ask(u.id, f.productId, '¿Cuál es el tamaño número 5?'), 'rate_limited');
    expect((await ask(u.id, f.productId, '¿Cuál es el tamaño número 0?')).id).toBe(first.id);
  });
  it('forbids direct table and helper access, and scopes the store inbox', async () => {
    await expect(asUser(buyer.id, sql => sql('select * from public.product_questions'))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(buyer.id, sql => sql("update public.product_questions set status='hidden'"))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(buyer.id, sql => sql('select question_private.actor()'))).rejects.toMatchObject({ code: '42501' });
    await expectHint(asUser(other.id, sql => sql('select public.store_questions($1)', [f.storeId])), 'store_access_denied');
    const page = await asUser(seller.id, async sql => (await sql("select public.store_questions($1,'pending',20,0) as p", [f.storeId]))[0].p);
    expect(page.can_answer).toBe(true); expect(page.items.every((q: { answer_body: string | null; status: string }) => q.answer_body === null && q.status === 'published')).toBe(true);
  });
  it('includes new UGC in closure classification and rejects writes from closing accounts', async () => {
    const u = await createUser('question-closing'); await ask(u.id, f.productId, '¿Cómo se limpia este producto?');
    const [row] = await admin('select account_private.blockers($1) as b', [u.id]);
    expect(row.b['product_questions.user_id']).toBe(1);
    await admin('insert into account_private.close_jobs(request_id,user_id) values($1,$2)', [randomUUID(), u.id]);
    await expectHint(ask(u.id, f.productId, '¿Incluye algún estuche?'), 'account_closed');
    const page = await list(u.id, f.productId); expect(page.can_ask).toBe(false); expect(page.items.every((q: { mine: boolean }) => !q.mine)).toBe(true);
  });
});
