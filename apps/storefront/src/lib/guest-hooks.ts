'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { guestCart, guestFavorites, guestCartKeys, guestFavoriteKeys } from './guest-storage';
import { guestError } from './guest-errors';
interface GuestReader<T> { read: () => Promise<T[]>; refresh: () => Promise<T[]>; subscribe: (listener: (items: T[]) => void) => () => void }
function useGuestState<T>(store: GuestReader<T>, keys: Set<string>) {
  const [state, setState] = useState<{ data: T[]; ready: boolean; error: Error | null }>({ data: [], ready: false, error: null });
  const revision = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    try { const data = await store.refresh(); if (mounted.current && revision.current === version) setState({ data, ready: true, error: null }); }
    catch (error) { if (mounted.current && revision.current === version) setState(old => ({ ...old, ready: true, error: guestError(error) })); }
  }, [store]);
  useEffect(() => {
    let active = true; mounted.current = true;
    const read = async () => {
      const version = ++revision.current;
      try { const data = await store.read(); if (active && revision.current === version) setState({ data, ready: true, error: null }); }
      catch (error) { if (active && revision.current === version) setState(old => ({ ...old, ready: true, error: guestError(error) })); }
    };
    const stop = store.subscribe(data => { if (active) { revision.current++; setState({ data, ready: true, error: null }); } });
    const changed = (event: StorageEvent) => { if (event.key === null || keys.has(event.key)) void read(); };
    window.addEventListener('storage', changed); void read();
    return () => { active = false; mounted.current = false; stop(); window.removeEventListener('storage', changed); };
  }, [store, keys]);
  return { ...state, refresh };
}
export function useGuestCartState() { return useGuestState(guestCart, guestCartKeys); }
export function useGuestFavoritesState() { return useGuestState(guestFavorites, guestFavoriteKeys); }
