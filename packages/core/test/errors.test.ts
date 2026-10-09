import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, toAppError } from '../src/errors';

const migrations = join(import.meta.dirname, '../../../supabase/migrations');

describe('error messages', () => {
  it('every hint raised by the database has buyer-facing copy', () => {
    const hints = new Set<string>();
    for (const f of readdirSync(migrations)) {
      for (const m of readFileSync(join(migrations, f), 'utf8').matchAll(/hint = '([a-z_]+)'/g)) hints.add(m[1]!);
    }
    expect(hints.size).toBeGreaterThan(30);
    expect([...hints].filter((h) => !ERROR_MESSAGES[h])).toEqual([]);
  });

  it('maps PostgREST errors, permission errors and network failures', () => {
    expect(toAppError({ code: 'P0001', hint: 'sold_out', message: 'x' }).message).toBe(ERROR_MESSAGES.sold_out);
    expect(toAppError({ code: '42501', message: 'permission denied' }).code).toBe('forbidden');
    expect(toAppError(new TypeError('Network request failed')).code).toBe('network');
    expect(toAppError({ code: 'XX000', message: 'boom' }).message).toBe(ERROR_MESSAGES.unknown);
  });

  it('shows the database detail for settings validation, and the generic copy when there is none', () => {
    const detail = 'El plazo de respuesta del vendedor (horas) debe ser un número entero.';
    expect(toAppError({ code: '22023', hint: 'invalid_setting', message: 'invalid setting', details: detail }).message).toBe(detail);
    expect(toAppError({ code: '22023', hint: 'invalid_setting', message: 'invalid setting' }).message).toBe(ERROR_MESSAGES.invalid_setting);
  });
});
