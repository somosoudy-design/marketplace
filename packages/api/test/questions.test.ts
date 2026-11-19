import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/api';
import type { KoraClient } from '../src/client';

function fixture(error: unknown = null) {
  const payload = { items: [], count: 0, can_ask: false, can_answer: false, can_moderate: false };
  const rpc = vi.fn(async () => ({ data: error ? null : payload, error }));
  const from = vi.fn(() => { throw new Error('Questions must use the authorized RPC surface'); });
  return { rpc, from, payload, api: createApi({ rpc, from } as unknown as KoraClient) };
}
describe('product question API contracts', () => {
  it('reads authorized product questions with explicit pagination', async () => {
    const f = fixture();
    expect(await f.api.questions.list('product', 7, 14)).toBe(f.payload);
    expect(f.rpc).toHaveBeenCalledWith('product_questions', { p_product_id: 'product', p_limit: 7, p_offset: 14 });
    expect(f.from).not.toHaveBeenCalled();
  });
  it('uses safe defaults for the product and store inbox', async () => {
    const f = fixture(); await f.api.questions.list('product'); await f.api.questions.storeInbox('store');
    expect(f.rpc).toHaveBeenNthCalledWith(1, 'product_questions', { p_product_id: 'product', p_limit: 10, p_offset: 0 });
    expect(f.rpc).toHaveBeenNthCalledWith(2, 'store_questions', { p_store_id: 'store', p_status: 'pending', p_limit: 20, p_offset: 0 });
  });
  it('asks and answers using actor-independent IDs only; the server derives identity and authorization', async () => {
    const f = fixture();
    await f.api.questions.ask('product', '¿Incluye cable?'); await f.api.questions.answer('question', 'Sí, incluye cable.');
    expect(f.rpc).toHaveBeenNthCalledWith(1, 'ask_question', { p_product_id: 'product', p_body: '¿Incluye cable?' });
    expect(f.rpc).toHaveBeenNthCalledWith(2, 'answer_question', { p_question_id: 'question', p_body: 'Sí, incluye cable.' });
  });
  it('passes moderation and inbox filters to the server instead of filtering hidden content in the client', async () => {
    const f = fixture();
    await f.api.questions.moderate('question', true, 'Datos de contacto');
    await f.api.questions.moderate('question', false);
    await f.api.questions.storeInbox('store', 'hidden', 5, 10);
    expect(f.rpc).toHaveBeenNthCalledWith(1, 'moderate_question', { p_question_id: 'question', p_hide: true, p_reason: 'Datos de contacto' });
    expect(f.rpc).toHaveBeenNthCalledWith(2, 'moderate_question', { p_question_id: 'question', p_hide: false, p_reason: null });
    expect(f.rpc).toHaveBeenNthCalledWith(3, 'store_questions', { p_store_id: 'store', p_status: 'hidden', p_limit: 5, p_offset: 10 });
  });
  it.each(['rate_limited', 'account_closed', 'admin_required', 'store_access_denied', 'question_contact'])('propagates %s without false success', async hint => {
    const f = fixture({ code: 'P0001', hint, message: 'server denied operation' });
    await expect(f.api.questions.ask('product', '¿Incluye cable?')).rejects.toMatchObject({ code: hint, name: 'ApiError' });
  });
});
