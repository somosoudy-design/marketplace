/** Public, immutable image approvals; never stores a user's session or purchase state. */
/** @typedef {{productId:string,originalPath:string,source:string,sha256:string,width:number,height:number,variantId?:string,originKind?:string,disclosure?:string,author?:string,license?:string,licenseUrl?:string,originUrl?:string,additionalSources?:{label:string,url:string}[]}} CommercialPhoto */
/** @param {{approvedProducts:string[],photos:CommercialPhoto[]}} manifest */
export function createCommercialCatalog(manifest) {
  const approved = new Set(manifest.approvedProducts);
  /** @type {Map<string, Map<string, CommercialPhoto[]>>} */
  const index = new Map();
  for (const photo of manifest.photos) {
    if (!approved.has(photo.productId) || !/^\/catalog\/[a-f0-9]{24}\.(?:webp|png|jpg)$/.test(photo.source) ||
      !/^[a-f0-9]{64}$/.test(photo.sha256) || !photo.source.includes(photo.sha256.slice(0, 24)))
      throw new Error('Invalid commercial image approval.');
    const paths = index.get(photo.productId) ?? new Map();
    const list = paths.get(photo.originalPath) ?? [];
    if (list.some(p => p.variantId === photo.variantId)) throw new Error('Duplicate commercial image identity.');
    list.push(photo); paths.set(photo.originalPath, list); index.set(photo.productId, paths);
  }
  /** @param {string} id @param {string|null|undefined} path @param {string} [variant] */
  function photo(id, path, variant) {
    const candidates = path ? index.get(id)?.get(path) : undefined;
    if (!candidates) return undefined;
    if (variant) {
      const exact = candidates.find(p => p.variantId === variant);
      if (exact) return exact;
      if (candidates.some(p => p.variantId)) return undefined;
    }
    return candidates.find(p => !p.variantId);
  }
  /** @template {{path:string}} T @param {string} id @param {T[]} images @param {string} [variant] @returns {T[]} */
  function gallery(id, images, variant) {
    if (!approved.has(id)) return images;
    const seen = new Set();
    return images.filter(image => {
      const selected = photo(id, image.path, variant);
      // Preserve a fresh seller upload; never fall back to superseded sample illustrations.
      if (!selected && image.path.startsWith('demo/')) return false;
      const key = selected?.source ?? image.path;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  return { approved: /** @param {string} id */ id => approved.has(id), photo, gallery,
    sample: /** @param {string} id @param {boolean} originSample */ (id, originSample) => originSample && !approved.has(id),
    blockedLegacy: /** @param {string} id @param {string|null|undefined} path */ (id, path) => approved.has(id) && !!path?.startsWith('demo/') };
}
