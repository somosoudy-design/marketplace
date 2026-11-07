import { describe, expect, it } from 'vitest';
import { closureLabel, closureMessage, closureResult } from '../src/lib/account-closure';

describe('account closure completion evidence', () => {
  it('does not interpret legacy completion as verified cleanup', () => {
    expect(closureLabel('completed')).toBe('Cierre anterior sin verificar');
    expect(closureLabel('completed', 'completed')).toBe('Cierre verificado');
  });
  it('preserves pending and interrupted results instead of turning them into completion', () => {
    for (const state of ['retention_pending', 'failed', 'processing', 'busy'] as const) {
      expect(closureResult({ requestId: 'request-a', state }, 'request-a').state).toBe(state);
      expect(closureMessage(state)).not.toContain('Cierre verificado:');
    }
  });
  it.each([null, {}, { success: true }, { requestId: 'request-a' }, { requestId: 'request-a', state: 'unknown' }])('rejects a successful transport without a verified contract: %j', (value) => {
    expect(() => closureResult(value, 'request-a')).toThrow('verificar');
  });
  it('rejects a result from a different request', () => {
    expect(() => closureResult({ requestId: 'request-b', state: 'completed' }, 'request-a')).toThrow('verificar');
  });
  it('accepts the explicit worker completion receipt for this request', () => {
    expect(closureResult({ requestId: 'request-a', state: 'completed' }, 'request-a')).toEqual({ requestId: 'request-a', state: 'completed' });
  });
});
