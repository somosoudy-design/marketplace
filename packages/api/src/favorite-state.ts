export type FavoriteEntry = { product_id: string; created_at: string };

/** Update one product without replacing concurrent changes to other favorites. */
export function favoriteState(rows: readonly FavoriteEntry[], productId: string, entry: FavoriteEntry | null): FavoriteEntry[] {
  const others = rows.filter((row) => row.product_id !== productId);
  return entry ? [...others, entry].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)) : others;
}
