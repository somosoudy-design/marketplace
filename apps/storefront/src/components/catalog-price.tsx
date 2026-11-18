'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convertFromUSD, formatVES } from '@kora/core';
import { browser } from '@/lib/browser';
import { configured } from '@/lib/env';
import { money } from '@/lib/format';

const ReferenceRate = createContext<number | null>(null);

/** One current reference for all merchandise prices on the page. The server still quotes payments. */
export function CatalogRateProvider({ children, ready, pathname }: { children: ReactNode; ready: boolean; pathname: string }) {
  const catalog = pathname === '/' || pathname === '/buscar' || pathname === '/favoritos' || pathname.startsWith('/p/');
  const status = useQuery({
    queryKey: ['public-usd-ves'],
    enabled: configured && ready && catalog,
    queryFn: () => browser().api.catalog.rate('USD/VES'),
    staleTime: 90_000,
    refetchInterval: 60_000,
  });
  const current = status.data;
  const rate = catalog && status.isSuccess && !status.isStale && status.fetchStatus !== 'paused' &&
    current?.available && current.source !== 'demo' && Number.isFinite(Number(current.rate)) && Number(current.rate) > 0
    ? Number(current.rate) : null;
  return <ReferenceRate.Provider value={rate}>{children}</ReferenceRate.Provider>;
}

export function CatalogPrice({ usd, compareAt }: { usd: number | null; compareAt?: number | null }) {
  const rate = useContext(ReferenceRate);
  if (usd == null || !Number.isFinite(usd)) return <strong>Precio no disponible</strong>;
  const inDollars = money(usd);
  const previous = compareAt != null && compareAt > usd ? <del>{money(compareAt)}</del> : null;
  if (rate == null) return <span className="catalog-price"><strong>{inDollars}</strong>{previous}</span>;
  const equivalent = formatVES(convertFromUSD(usd, rate, 'VES'));
  return (
    <span className="catalog-price">
      <strong className="catalog-price-ves" title="Referencia a la tasa vigente">
        {equivalent}<span className="sr-only">, referencia en bolívares</span>
      </strong>
      <span className="catalog-price-usd">{inDollars}{previous}</span>
    </span>
  );
}
