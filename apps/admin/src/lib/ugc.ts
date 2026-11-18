'use client';
import { runUgcActor, type Api, type UgcPolicy, type UgcStatus } from '@kora/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { koraForActor } from './kora';
import { ugcOwner } from './ugc-owner';
import { readUgcState } from './ugc-query';

export function useUgc() {
  const { ready, userId: actorId } = useAuth(); const qc = useQueryClient();
  const owner = useSyncExternalStore(ugcOwner.subscribe, ugcOwner.snapshot, ugcOwner.snapshot); const mounted = useRef(true);
  const actorReady = ready === true && owner.actor === actorId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isOwnerCurrent = () => ugcOwner.snapshot() === owner && owner.actor === actorId;
  const isCurrent = () => mounted.current && isOwnerCurrent();
  const run = <T,>(operation: (api: Api, check: () => Promise<void>) => Promise<T>) => runUgcActor(actorId, isCurrent, koraForActor, operation);
  const read = <T,>(operation: (api: Api, check: () => Promise<void>) => Promise<T>) => runUgcActor(actorId, isOwnerCurrent, koraForActor, operation);
  const state = useQuery<UgcStatus | UgcPolicy>({ queryKey: ['ugc-state', actorId, owner.revision], enabled: actorReady && !!actorId,
    queryFn: () => readUgcState(actorId, owner, ugcOwner.snapshot, koraForActor),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const refresh = async () => {
    if (!isCurrent()) return;
    await qc.invalidateQueries({ queryKey: ['ugc-state', actorId] });
    if (!isCurrent()) return;
    await qc.invalidateQueries({ queryKey: ['ugc-staff-reviews', actorId] });
    await qc.invalidateQueries({ queryKey: ['ugc-reviews-summary', actorId] });
    await qc.invalidateQueries({ queryKey: ['ugc-reports', actorId] });
  };
  return { actorId, actorReady, ownerRevision: owner.revision, state: actorReady ? state : { ...state, data: undefined }, enabled: actorReady && state.isSuccess && state.data?.enabled === true && !state.isFetching, run, read, refresh, isCurrent, isOwnerCurrent };
}
