export interface CommercialPhoto {
  productId: string;
  originalPath: string;
  source: string;
  sha256: string;
  width: number;
  height: number;
  variantId?: string;
  originKind?: string;
  disclosure?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  originUrl?: string;
  additionalSources?: readonly { label: string; url: string }[];
}
export interface CommercialManifest { approvedProducts: string[]; photos: CommercialPhoto[]; }
export function createCommercialCatalog(manifest: CommercialManifest): {
  approved(id: string): boolean;
  photo(id: string, path: string | null | undefined, variant?: string): CommercialPhoto | undefined;
  gallery<T extends { path: string }>(id: string, images: T[], variant?: string): T[];
  sample(id: string, originSample: boolean): boolean;
  blockedLegacy(id: string, path: string | null | undefined): boolean;
};
