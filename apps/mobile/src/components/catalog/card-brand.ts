/** Split only a confirmed, complete leading brand; leave all other titles untouched. */
export function splitCardBrand(title: string, brandName: string | null | undefined): { name: string; brand: string | null } {
  const brand = brandName?.trim();
  const candidate = title.trimStart();
  if (!brand || candidate.slice(0, brand.length).toLocaleLowerCase('es') !== brand.toLocaleLowerCase('es')) return { name: title, brand: null };
  const tail = candidate.slice(brand.length);
  if (!/^[\s:·\-–—/]+/u.test(tail)) return { name: title, brand: null };
  const name = tail.replace(/^[\s:·\-–—/]+/u, '').trim();
  return name ? { name, brand: candidate.slice(0, brand.length) } : { name: title, brand: null };
}
