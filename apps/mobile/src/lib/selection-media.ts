/** General photographs must not reuse an image explicitly assigned to any known variant. */
export function unassignedProductImages<T extends { id?: string; path: string }>(images: readonly T[], assigned: readonly { id?: string; path: string }[]): T[] {
  const ids = new Set(assigned.flatMap(image => image.id ? [image.id] : []));
  const paths = new Set(assigned.map(image => image.path));
  return images.filter(image => !(image.id && ids.has(image.id)) && !paths.has(image.path));
}

/** Only the server can classify general photographs against hidden/inactive variants. */
export function reviewedGeneralProductImages<T extends { id?: string; path: string }>(product: { general_images?: readonly T[] | null }, assigned: readonly { id?: string; path: string }[] = []): T[] {
  return unassignedProductImages(product.general_images ?? [], assigned);
}
