/** Keep measurements together in display copy without changing the stored product title. */
export function bannerTitle(title: string): string {
  return title.replace(/(\d[\d.,]*)[ \t]+(mAh|kWh|Wh|W|V|A|TB|GB|MB|kg|g|mm|cm|ml|Hz|kHz|TX|RX)(?=$|[\s),;+/])/giu, '$1\u00a0$2');
}

export interface PhotoChoiceNoticeInput {
  selectedVariantId: string | null | undefined;
  variants: readonly { id: string; active: boolean }[] | null | undefined;
  mediaState: 'unclassified' | 'assigned' | 'none';
  imagePath: string | null | undefined;
}

/** Presentation only: absence of a notice never certifies a stored photo association. */
export function photoChoiceNotice(input: PhotoChoiceNoticeInput): string | null {
  if (!input.imagePath || input.mediaState !== 'unclassified' || !input.selectedVariantId || !input.variants) return null;
  const active = new Set(input.variants.filter(variant => variant.active).map(variant => variant.id));
  return active.has(input.selectedVariantId) && active.size > 1
    ? 'Las fotos pueden variar según la opción elegida.'
    : null;
}
