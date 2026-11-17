export type BrowseSection = 'catalog' | 'newest' | 'on_order';

/** The URL is the shared source of truth for desktop and mobile section links. */
export function browseSection(params: { get(name: string): string | null }): BrowseSection {
  if (params.get('availability') === 'on_order') return 'on_order';
  if (params.get('sort') === 'newest') return 'newest';
  return 'catalog';
}
