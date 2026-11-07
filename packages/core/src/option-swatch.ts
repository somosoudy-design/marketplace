/** Decorative only: this never creates an option, photo association or purchasable variant. */
export type OptionSwatchTone = 'black' | 'white' | 'gray' | 'purple';
const swatches = new Map<string, OptionSwatchTone>([
  ['negro', 'black'], ['blanco', 'white'], ['gris', 'gray'], ['purpura', 'purple'],
]);
export function optionSwatchTone(label: string): OptionSwatchTone | null {
  return swatches.get(label.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) ?? null;
}

/** Keep explicit attributes; a legacy, exact colour name may decorate its existing title only. */
export function variantSwatchLabel(variant: { title?: string; options?: Record<string, string> }): string | null {
  const declared = new Set(Object.entries(variant.options ?? {})
    .filter(([name, value]) => name.trim().toLowerCase() === 'color' && typeof value === 'string' && value.trim())
    .map(([, value]) => value));
  if (declared.size) return declared.size === 1 ? [...declared][0]!.trim() : null;
  const title = variant.title?.trim();
  return title && optionSwatchTone(title) ? title : null;
}
