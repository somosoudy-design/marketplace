'use client';
import type { PricingSnapshot } from '@kora/api';
import type { GapSnapshot } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { kora } from './kora';

// The day's gap the prices are built with (docs/PRECIOS.md). Previews in the panel use the shared core with these
// rates; the database repeats the calculation and is what charges.

export const inForce = (s: PricingSnapshot | null | undefined): boolean => !!s && new Date(s.valid_until).getTime() > Date.now();
export const gapRates = (s: PricingSnapshot): GapSnapshot => ({ bcv: s.bcv_rate, usdt_ves: s.usdt_ves_rate, usd_usdt: s.usd_usdt_rate });
export const pct = (v: string | number) => `${String(Number(Number(v).toFixed(2))).replace('.', ',')} %`;

/** Last snapshots (admins read them); `current` is the one in force, null when the last one expired. */
export function useGap() {
  const q = useQuery({ queryKey: ['pricing-snapshots'], queryFn: () => kora().api.admin.pricingSnapshots(8) });
  const current = q.data?.find(inForce) ?? null;
  return { ...q, current };
}
