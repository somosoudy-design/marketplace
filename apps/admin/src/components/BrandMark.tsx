import { brand, brandMarkWidths } from '@/lib/brand';
import artwork from '../../../../config/brand-artwork.json';

/** Original Work artwork. Header/form spacing supplies its clear space; no CSS recoloring. */
export function BrandMark({ access = false }: { access?: boolean }) {
  const width = access ? brandMarkWidths.access : brandMarkWidths.navigation;
  return (
    <span role="img" aria-label={brand.name} className="inline-flex min-h-[44px] shrink-0 items-center" style={{ width }}>
      <picture className="block w-full">
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/mayami-v3/MAYAMI_Logotipo_Blanco.svg" />
        {/* The supplied SVG is already optimized and must retain the original paths. */}
        <img src="/brand/mayami-v3/MAYAMI_Logotipo_Violeta.svg" alt="" draggable={false}
          width={width} height={width * artwork.height / artwork.width} className="block h-auto w-full" />
      </picture>
    </span>
  );
}
