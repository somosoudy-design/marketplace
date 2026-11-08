'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { db, run } from './kora';

/** Names for a set of user ids (admins can read profiles). */
export function useProfiles(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])].sort();
  const q = useQuery({
    queryKey: ['profiles', unique],
    queryFn: () => run<{ id: string; full_name: string | null; phone: string | null }[]>(db('profiles').select('id, full_name, phone').in('id', unique)),
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
  });
  const map = new Map((q.data ?? []).map((p) => [p.id, p]));
  return (id: string | null | undefined) => (id ? map.get(id)?.full_name ?? 'Cliente' : '—');
}

export function useStoresIndex() {
  const q = useQuery({
    queryKey: ['stores-index'],
    queryFn: () => run<{ id: string; name: string; slug: string; status: string; kind: string }[]>(db('stores').select('id, name, slug, status, kind').order('name')),
    staleTime: 60_000,
  });
  const map = new Map((q.data ?? []).map((s) => [s.id, s]));
  return { list: q.data ?? [], name: (id: string | null | undefined) => (id ? map.get(id)?.name ?? '—' : '—') };
}

export function useCategoriesIndex() {
  const q = useQuery({
    queryKey: ['categories-index'],
    queryFn: () => run<{ id: string; name: string; slug: string; parent_id: string | null; risk_level: string; requires_review: boolean; active: boolean }[]>(db('categories').select('id, name, slug, parent_id, risk_level, requires_review, active').order('sort')),
    staleTime: 60_000,
  });
  const map = new Map((q.data ?? []).map((c) => [c.id, c]));
  return { list: q.data ?? [], name: (id: string | null | undefined) => (id ? map.get(id)?.name ?? '—' : '—') };
}

/**
 * The record a detail page shows (/admin/pedidos/ver?id=…, /vendedor/productos/editar?id=…). The id travels in the
 * query so the static panel needs one page per screen, not one per record; '' when there is none (a new product).
 * Pages that use it render inside <Suspense> (required by useSearchParams in a static export).
 */
export function useQueryId(): string {
  return useSearchParams().get('id') ?? '';
}
