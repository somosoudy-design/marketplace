import Link from 'next/link';
import { ArrowRight, CircleHelp, Package, Store, Undo2 } from 'lucide-react';
import {
  describeDispatchStage,
  presentOfferAvailability,
  sourceDescriptionSections,
  type Availability,
} from '@kora/core';

export function OfferStatus({
  availability,
  stock,
  issue,
  overlay = false,
}: {
  availability: Availability;
  stock?: number | null;
  issue?: string | null;
  overlay?: boolean;
}) {
  const state = presentOfferAvailability(availability, stock, issue);
  return (
    <span
      className={overlay ? 'product-status-badge' : 'product-status-badge detail-status'}
      data-tone={state.tone}
      data-testid="product-availability"
    >
      {state.label}
    </span>
  );
}

export function SellerLink({ name, slug }: { name: string; slug: string }) {
  return (
    <Link prefetch={false} className="seller-link" href={`/tienda/${encodeURIComponent(slug)}`}>
      <Store size={17} aria-hidden="true" />
      <span>
        Vendido por <strong>{name}</strong>
      </span>
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

export function DeliveryStage({
  availability,
  minimum,
  maximum,
}: {
  availability: Availability;
  minimum?: number | null;
  maximum?: number | null;
}) {
  const stage = describeDispatchStage(availability, minimum, maximum);
  return stage ? (
    <p className="dispatch-stage">
      <Package size={16} aria-hidden="true" />
      <span>{stage}</span>
    </p>
  ) : null;
}

export function PurchaseHelp() {
  return (
    <nav className="purchase-help" aria-label="Ayuda para tu compra">
      <Link prefetch={false} href="/devoluciones">
        <Undo2 size={16} aria-hidden="true" />
        Devoluciones y garantías
      </Link>
      <Link prefetch={false} href="/contacto">
        <CircleHelp size={16} aria-hidden="true" />
        Ayuda con tu compra
      </Link>
    </nav>
  );
}

export function ProductContent({
  description,
  highlights,
  seller,
}: {
  description?: string | null;
  highlights?: string[] | null;
  seller: string;
}) {
  const sections = sourceDescriptionSections(description);
  if (!sections.length && !highlights?.length) return null;
  return (
    <section className="detail-description" id="product-content" aria-labelledby="product-content-title">
      <header>
        <h2 id="product-content-title">Sobre este producto</h2>
        <p>Información publicada por {seller}</p>
      </header>
      {highlights?.length ? (
        <ul className="product-highlights">
          {highlights.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      ) : null}
      <div className="description-sections">
        {sections.map((section, index) => {
          const specs = section.heading?.toLowerCase().startsWith('especificaciones');
          return (
            <section
              key={index}
              className={section.heading ? 'description-section' : 'description-section description-intro'}
            >
              {section.heading && <h3>{section.heading}</h3>}
              <DescriptionLines lines={section.lines} specifications={!!specs} />
            </section>
          );
        })}
      </div>
    </section>
  );
}

function DescriptionLines({ lines, specifications }: { lines: string[]; specifications: boolean }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const list = /^[•\-–]\s+/.test(line);
    const text = list ? line.replace(/^[•\-–]\s+/, '') : line;
    const previous = blocks[blocks.length - 1];
    if (list && previous?.list) previous.lines.push(text);
    else blocks.push({ list, lines: [text] });
  }
  return blocks.map((block, index) => {
    if (!block.list) return <p key={index}>{block.lines[0]}</p>;
    if (specifications && block.lines.every((text) => text.indexOf(':') > 0)) {
      return (
        <dl key={index} className="specifications">
          {block.lines.map((text, row) => {
            const separator = text.indexOf(':');
            return (
              <div className="specification" key={row}>
                <dt>{text.slice(0, separator)}</dt>
                <dd>{text.slice(separator + 1).trim()}</dd>
              </div>
            );
          })}
        </dl>
      );
    }
    return (
      <ul key={index} className="description-list">
        {block.lines.map((text, row) => (
          <li key={row}>{text}</li>
        ))}
      </ul>
    );
  });
}
