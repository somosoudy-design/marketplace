import type { ProductCard } from '@kora/api';
export const DISCOVERY_BATCH = 12;
export const DISCOVERY_WINDOW = 60;
/** Stable within a visit; rotating each bounded catalogue window never changes page membership. */
export function discoveryWindow<T extends { id: string }>(rows: T[], seed: string): T[] {
  const hash = (id: string) => { let n = 2166136261; for (const c of seed + id) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
  return [...new Map(rows.map(row => [row.id, row])).values()].sort((a,b) => hash(a.id)-hash(b.id) || a.id.localeCompare(b.id));
}
export function discoveryGroups(products: ProductCard[]) {
  const groups = new Map<string, ProductCard[]>();
  for (const p of products) { const key = p.category_slug || ''; groups.set(key, [...(groups.get(key) ?? []), p]); }
  const sections = [...groups].filter(([,rows]) => rows.length >= 3).map(([slug,rows]) => ({title:rows[0]!.category_name,slug,products:rows}));
  const grouped = new Set(sections.flatMap(s => s.products.map(p => p.id)));
  const mixed = products.filter(p => !grouped.has(p.id));
  if (mixed.length) sections.push({title:'Más para descubrir',slug:'',products:mixed});
  return sections;
}
