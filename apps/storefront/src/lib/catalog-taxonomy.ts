import type { Category } from '@kora/api';

/** Stable hierarchy, retaining orphaned or cyclic records as accessible fallbacks. */
export function catalogCategories(categories: readonly Category[]) {
  const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const ids = new Set(ordered.map(category => category.id));
  const seen = new Set<string>();
  const result: { category: Category; depth: number }[] = [];
  function append(category: Category, depth: number) {
    if (seen.has(category.id)) return;
    seen.add(category.id);
    result.push({ category, depth });
    ordered.filter(child => child.parent_id === category.id).forEach(child => append(child, depth + 1));
  }
  ordered.filter(category => !category.parent_id || !ids.has(category.parent_id)).forEach(category => append(category, 0));
  ordered.forEach(category => append(category, 0));
  return result;
}

export function catalogCategoryGroups(categories: readonly Category[]) {
  const groups: { parent: Category; children: { category: Category; depth: number }[] }[] = [];
  for (const item of catalogCategories(categories)) {
    const group = groups.at(-1);
    if (item.depth === 0 || !group) groups.push({ parent: item.category, children: [] });
    else group.children.push(item);
  }
  return groups;
}
