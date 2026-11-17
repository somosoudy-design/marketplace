import artwork from '../../../../config/brand-artwork.json';
import { brandMarkWidths } from '../../../../config/brand-presentation';

/** Both files are original Work SVGs, served locally. The enclosing link supplies the accessible name. */
export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  if (inverse)
    return (
      <picture className="brand-artwork">
        {compact && <source media="(max-width: 379px)" srcSet="/brand/mayami-v3/MAYAMI_Simbolo_Optico_Blanco.svg" />}
        <img
          src="/brand/mayami-v3/MAYAMI_Logotipo_Blanco.svg"
          alt=""
          draggable={false}
          width={brandMarkWidths.navigation}
          height={(brandMarkWidths.navigation * artwork.height) / artwork.width}
        />
      </picture>
    );
  return (
    <picture className="brand-artwork">
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/mayami-v3/MAYAMI_Logotipo_Blanco.svg" />
      {/* Static vector: preserve its paths and proportions, without image processing. */}
      <img
        src="/brand/mayami-v3/MAYAMI_Logotipo_Violeta.svg"
        alt=""
        draggable={false}
        width={brandMarkWidths.navigation}
        height={(brandMarkWidths.navigation * artwork.height) / artwork.width}
      />
    </picture>
  );
}
