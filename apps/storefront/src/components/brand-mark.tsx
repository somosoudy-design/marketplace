import artwork from '../../../../config/brand-artwork.json';

/** Both files are original Work SVGs, served locally. The enclosing link supplies the accessible name. */
export function BrandMark() {
  return (
    <picture className="brand-artwork">
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/mayami-v3/MAYAMI_Logotipo_Blanco.svg" />
      {/* Static vector: preserve its paths and proportions, without image processing. */}
      <img src="/brand/mayami-v3/MAYAMI_Logotipo_Violeta.svg" alt="" draggable={false}
        width={artwork.minimumScreenWidth} height={artwork.minimumScreenWidth * artwork.height / artwork.width} />
    </picture>
  );
}
