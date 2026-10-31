'use client';
import { useQuery } from '@tanstack/react-query';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { ProductPhoto } from './photo';
type Line = {
  product_id: string;
  variant_id: string | null;
  image_path: string | null;
  title: string;
  variant_title: string | null;
  quantity: number;
  line_total_usd: number;
};
export function ReviewLine({ line: l }: { line: Line }) {
  const product = useQuery({
    queryKey: ['product', l.product_id],
    queryFn: () => browser().api.catalog.product(l.product_id),
  });
  const p = product.data;
  const demo =
    !!p?.is_demo &&
    (p.image_path === l.image_path || p.images.some((i) => i.path === l.image_path)) &&
    (!l.variant_id || p.variants.some((v) => v.id === l.variant_id));
  return (
    <div className="review-line">
      <ProductPhoto
        id={l.product_id}
        path={l.image_path}
        demo={demo}
        variant={l.variant_id ?? undefined}
        title={l.title}
      />
      <div className="review-copy">
        <h3>{l.title}</h3>
        <p>
          {l.variant_title} · Cantidad {l.quantity}
        </p>
        <strong>{money(l.line_total_usd)}</strong>
        {'issue' in l && l.issue ? <p className="error">Revisa la disponibilidad en tu carrito.</p> : null}
      </div>
    </div>
  );
}
