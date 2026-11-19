import { formatMoney, type Currency, type MoneyValue } from './money';
import { presentAvailability, type Availability } from './availability';

/** Presentation only. Keep the currency explicit without changing amounts or rounding. */
export function formatOfferPrice(value: MoneyValue | null | undefined, currency: Currency = 'USD'): string {
  const formatted = formatMoney(value, currency);
  return currency === 'USD' && formatted !== '—' ? `${formatted} USD` : formatted;
}

/** A legacy placeholder never replaces a meaningful variant name or its attributes. */
export function variantDisplayTitle(
  title: string | null | undefined,
  options?: Record<string, string> | null,
): string | null {
  const generic =
    !title?.trim() ||
    title
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() === 'unica';
  if (!generic) return title!;
  const values = Object.values(options ?? {}).filter((value) => value.trim());
  return values.length ? values.join(' · ') : null;
}

export function variantAttributeLabel(
  optionNames: readonly string[] | null | undefined,
  variants: readonly { options?: Record<string, string>; color?: string | null }[],
): string {
  const declared = optionNames?.filter((name) => name.trim()) ?? [];
  const names = declared.length ? declared : variants.flatMap((variant) => Object.keys(variant.options ?? {}));
  const labels: Record<string, string> = {
    color: 'Color',
    colour: 'Color',
    talla: 'Talla',
    size: 'Talla',
    capacidad: 'Capacidad',
    capacity: 'Capacidad',
    storage: 'Capacidad',
  };
  const attributes = [
    ...new Set(names.filter((name) => name.trim()).map((name) => labels[name.trim().toLowerCase()] ?? name.trim())),
  ];
  return attributes.length
    ? attributes.join(' / ')
    : variants.some((variant) => variant.color?.trim())
      ? 'Color'
      : 'Opciones';
}

/** Keep an excess quantity visible so the buyer can reduce it deliberately. */
export function quantityControlState(quantity: number, maximum: number, editable = true, pending = false) {
  const valid = Number.isSafeInteger(quantity) && quantity >= 1;
  const max = Number.isSafeInteger(maximum) && maximum > 0 ? maximum : 0;
  return {
    maximum: max,
    valid: valid && quantity <= max,
    canDecrease: editable && !pending && valid && quantity > 1,
    canIncrease: editable && !pending && valid && quantity < max,
  };
}

/** Preserve the commercial modality independently of a variant's current stock. */
export function presentOfferAvailability(availability: Availability, stock?: number | null, issue?: string | null) {
  const base = presentAvailability(availability);
  const unavailable = availability === 'unavailable' || issue === 'unavailable';
  const soldOut = stock === 0 || issue === 'sold_out';
  return {
    ...base,
    availabilityLabel: base.label,
    action: unavailable || soldOut ? ('Avisarme' as const) : base.action,
    intent: unavailable || soldOut ? ('notify' as const) : base.intent,
    label: unavailable ? 'No disponible' : soldOut ? 'Agotado' : base.label,
    tone: unavailable || soldOut ? ('muted' as const) : base.tone,
    purchasable: base.purchasable && !unavailable && !soldOut,
  };
}

export interface ProductDescriptionSection {
  heading: string | null;
  lines: string[];
}
/** Structure only explicit headings. The original statements stay seller-authored content. */
export function sourceDescriptionSections(description: string | null | undefined): ProductDescriptionSection[] {
  const sections: ProductDescriptionSection[] = [];
  const headings =
    /^(características(?: principales)?|especificaciones(?: generales| técnicas)?|ficha técnica|qué incluye(?: la caja)?|contenido(?: de la caja| del paquete)?|incluye|compatibilidad|dimensiones|garantía|entrega(?: estimada)?|información de entrega)$/i;
  for (const line of (description ?? '').split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    if (headings.test(text.replace(/:$/, ''))) sections.push({ heading: text.replace(/:$/, ''), lines: [] });
    else {
      if (!sections.length) sections.push({ heading: null, lines: [] });
      sections[sections.length - 1]!.lines.push(text);
    }
  }
  return sections;
}
