'use client';
import { useId, useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { publicBrandLink } from '../../../../config/brand-presentation';

/** Keep a selectable public link available even when sharing or clipboard access is denied. */
export function ProductShare({ slug, title, variantId }: { slug: string; title: string; variantId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useRef(0);
  const pending = useRef(false);
  const titleId = useId();
  const linkId = useId();
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const link = publicBrandLink(`/p/${encodeURIComponent(slug)}${variantId ? `?variant=${encodeURIComponent(variantId)}` : ''}`);
  const reset = () => { session.current++; pending.current = false; setBusy(false); setCopied(false); setError(''); };
  const close = () => { reset(); dialog.current?.close(); };
  const run = async (action: 'copy' | 'share') => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setCopied(false);
    const current = session.current;
    try {
      if (action === 'copy') {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
        await navigator.clipboard.writeText(link);
        if (session.current === current) setCopied(true);
      } else {
        await navigator.share({ title, text: `${title} en mayami`, url: link });
        if (session.current === current) close();
      }
    } catch (failure) {
      if (session.current === current && !(action === 'share' && failure instanceof Error && failure.name === 'AbortError'))
        setError(action === 'copy' ? 'No pudimos copiar el enlace. Puedes seleccionarlo y copiarlo manualmente.' : 'No pudimos compartir. Puedes copiar el enlace o volver a intentarlo.');
    } finally { if (session.current === current) { pending.current = false; setBusy(false); } }
  };
  return <>
    <button type="button" className="product-share-trigger" aria-label="Compartir producto" aria-haspopup="dialog" onClick={() => { reset(); setCanShare(typeof navigator.share === 'function'); dialog.current?.showModal(); }}>
      <Share2 size={18} aria-hidden="true" /><span>Compartir</span>
    </button>
    <dialog ref={dialog} className="product-share-dialog" aria-labelledby={titleId} onClose={event => {
      // A previous close event can arrive after the user opens the dialog again.
      if (!event.currentTarget.open) reset();
    }}>
      <button type="button" className="dialog-close" aria-label="Cerrar opciones de compartir" onClick={close}><X size={20} aria-hidden="true" /></button>
      <h2 id={titleId}>Compartir producto</h2>
      <p className="product-share-name">{title}</p>
      <label htmlFor={linkId}>Enlace del producto</label>
      <input id={linkId} type="text" readOnly value={link} onFocus={event => event.currentTarget.select()} />
      <div className="product-share-actions">
        {canShare && <button type="button" className="button" disabled={busy} aria-busy={busy} onClick={() => void run('share')}><Share2 size={18} aria-hidden="true" />Compartir</button>}
        <button type="button" className="button secondary" disabled={busy} aria-busy={busy} onClick={() => void run('copy')}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
      </div>
      <p role="status" className="product-share-feedback">{copied ? 'Enlace copiado' : ''}</p>
      {error && <p role="alert" className="error">{error}</p>}
    </dialog>
  </>;
}
