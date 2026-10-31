'use client';
import { Heart } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
export function Favorite({ id, title }: { id: string; title: string }) {
  const { session, ready } = useAccount();
  const user = session?.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const favorites = useQuery({
    queryKey: ['favorites', user],
    queryFn: () => browser().api.account.favorites(),
    enabled: !!user,
  });
  const active = favorites.data?.some((row) => row.product_id === id) ?? false;
  const mutation = useMutation({
    mutationFn: () => browser().api.account.setFavorite(user!, id, !active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', user] }),
  });
  return (
    <>
      <button
        type="button"
        className="favorite"
        aria-label={`${favorites.isError ? 'Reintentar cargar' : active ? 'Quitar de' : 'Guardar en'} favoritos: ${title}`}
        aria-pressed={active}
        disabled={!ready || mutation.isPending || (!!user && favorites.isPending)}
        onClick={() =>
          user
            ? favorites.isError
              ? void favorites.refetch()
              : mutation.mutate()
            : router.push(`/cuenta?volver=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        }
      >
        <Heart size={19} fill={active ? 'currentColor' : 'none'} />
      </button>
      {mutation.isError && (
        <span className="inline-error" role="alert">
          No se pudo guardar. Intenta de nuevo.
        </span>
      )}
    </>
  );
}
