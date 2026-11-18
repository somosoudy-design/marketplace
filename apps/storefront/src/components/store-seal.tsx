'use client';

import { useId, useRef } from 'react';
import { BadgeCheck } from 'lucide-react';

export function StoreSeal({ name, tier, label, description }: {
  name: string;
  tier: string;
  label: string;
  description: string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="store-seal" data-tier={tier}
      aria-label={`${name}: ${label}. Qué significa`} aria-haspopup="dialog" aria-controls={id}
      onClick={() => dialog.current?.showModal()}>
      <BadgeCheck aria-hidden="true" />
    </button>
    <dialog id={id} className="store-seal-note" ref={dialog} aria-labelledby={`${id}-title`}>
      <strong id={`${id}-title`}>{label}</strong>
      <p>{description}</p>
      <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>Entendido</button>
    </dialog>
  </>;
}
