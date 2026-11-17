'use client';
import { Minus, Plus } from 'lucide-react';
import { quantityControlState } from '@kora/core';

export function QuantityControl({
  quantity,
  maximum,
  label,
  editable = true,
  pending = false,
  onChange,
}: {
  quantity: number;
  maximum: number;
  label: string;
  editable?: boolean;
  pending?: boolean;
  onChange: (quantity: number) => void;
}) {
  const state = quantityControlState(quantity, maximum, editable, pending);
  return (
    <div className="quantity-control" role="group" aria-label={`Cantidad de ${label}`} aria-busy={pending}>
      <button
        type="button"
        aria-label={`Reducir cantidad de ${label}`}
        disabled={!state.canDecrease}
        onClick={() => onChange(quantity - 1)}
      >
        <Minus size={17} aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-label="Cantidad">
        {quantity}
      </output>
      <button
        type="button"
        aria-label={`Aumentar cantidad de ${label}`}
        disabled={!state.canIncrease}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
