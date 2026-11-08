'use client';
import { productConditionLabel, type ProductCondition } from '@kora/core';
import { money } from '@/lib/format';
import { ProductPhoto } from './photo';
type Line = {
  product_condition?: ProductCondition|null;
  image_scope?: 'general'|'variant';
  product_id: string;
  variant_id: string | null;
  image_path: string | null;
  title: string;
  variant_title: string | null;
  quantity: number;
  line_total_usd: number;
};
export function ReviewLine({ line: l }: { line: Line }) {
  return (
    <div className="review-line">
      <ProductPhoto
        id={l.product_id}
        path={l.image_path}
        demo={false}
        variant={l.variant_id ?? undefined}
        exact
        title={l.title}
      />
      <div className="review-copy">
        <h3>{l.title}</h3>
        {productConditionLabel(l.product_condition)?<p>{productConditionLabel(l.product_condition)}</p>:null}
        <p>
          {l.variant_title} · Cantidad {l.quantity}
        </p>
        <strong>{money(l.line_total_usd)}</strong>
        {'issue' in l && l.issue ? <p className="error">Revisa la disponibilidad en tu carrito.</p> : null}
      </div>
    </div>
  );
}
