/** Form validation only. The server remains the authority for rate selection and amounts. */
export type RatePolicyDraft = { primary: string; fallbacks: string; margin: string; maxAge: string; rounding: string };
export type RatePolicySource = { code: string; pair: string; enabled: boolean };

export function ratePolicyPayload(pair: string, draft: RatePolicyDraft, sources: RatePolicySource[]) {
  const primary = draft.primary.trim();
  const fallbacks = draft.fallbacks.split(',').map((value) => value.trim()).filter(Boolean);
  const selected = [primary, ...fallbacks];
  const usable = sources.filter((source) => source.pair === pair || source.pair === '*');
  if (!primary || !usable.some((source) => source.code === primary)) {
    throw new Error(`Selecciona una fuente principal compatible con ${pair}.`);
  }
  const unknown = fallbacks.filter((code) => !usable.some((source) => source.code === code));
  if (unknown.length) throw new Error(`Fuentes no compatibles con ${pair}: ${unknown.join(', ')}.`);
  if (new Set(selected).size !== selected.length) throw new Error('Usa cada fuente una sola vez entre principal y respaldos.');
  if (!usable.some((source) => source.enabled && selected.includes(source.code))) {
    throw new Error('Activa al menos una de las fuentes seleccionadas antes de guardar.');
  }
  const margin = Number(draft.margin.replace(',', '.'));
  if (!draft.margin.trim() || !Number.isFinite(margin) || margin < 0 || margin > 20) {
    throw new Error('El margen debe estar entre 0% y 20%.');
  }
  const maxAge = Number(draft.maxAge);
  if (!draft.maxAge.trim() || !Number.isSafeInteger(maxAge) || maxAge < 5) {
    throw new Error('La antigüedad debe ser un número entero de al menos 5 minutos.');
  }
  const rounding = Number(draft.rounding);
  if (!draft.rounding.trim() || !Number.isInteger(rounding) || rounding < 0 || rounding > 8) {
    throw new Error('Los decimales deben ser un número entero entre 0 y 8.');
  }
  return { primary_source: primary, fallback_sources: fallbacks, margin_pct: margin, max_age_minutes: maxAge, rounding_decimals: rounding };
}
