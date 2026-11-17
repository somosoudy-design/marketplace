'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';

const fields = ['category', 'availability', 'min', 'max'] as const;
export function SearchFilters({ children, active, clearHref, applied }: {
  children: ReactNode;
  active: number;
  clearHref?: string;
  applied: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const mobile = useRef(false);
  const resetDraft = useCallback(() => {
    form.current?.reset();
    (form.current?.elements.namedItem('max') as HTMLInputElement | null)?.setCustomValidity('');
    setDirty(false);
    setPending(false);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const resize = () => {
      mobile.current = media.matches;
      const dialog = panel.current;
      if (!dialog) return;
      if (media.matches) {
        if (dialog.open) dialog.close();
      } else if (!dialog.open || dialog.matches(':modal')) {
        dialog.close();
        // Opening a non-modal sidebar on resize must not steal focus.
        dialog.setAttribute('open', '');
      }
      setOpen(false);
      resetDraft();
    };
    const restore = () => resetDraft();
    resize();
    media.addEventListener('change', resize);
    window.addEventListener('pageshow', restore);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('pageshow', restore); };
  }, [resetDraft]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  function show() {
    resetDraft();
    panel.current?.close();
    panel.current?.showModal();
    setOpen(true);
    form.current?.querySelector<HTMLElement>('.filter-body input:not([type="hidden"]), .filter-body select')?.focus();
  }
  function close() { resetDraft(); panel.current?.close(); setOpen(false); trigger.current?.focus(); }
  function validateRange(event: FormEvent<HTMLFormElement>) {
    const minimum = event.currentTarget.elements.namedItem('min') as HTMLInputElement;
    const maximum = event.currentTarget.elements.namedItem('max') as HTMLInputElement;
    if (minimum.value !== '' && maximum.value !== '' && minimum.valueAsNumber > maximum.valueAsNumber) {
      event.preventDefault();
      maximum.setCustomValidity('El precio máximo debe ser igual o mayor al mínimo.');
      maximum.reportValidity();
      return;
    }
    setPending(true);
  }
  return (
    <aside className="search-sidebar" data-open={open}>
      <button ref={trigger} type="button" className="filter-toggle" aria-expanded={open} aria-controls="catalog-filters" aria-haspopup="dialog" onClick={show}>
        <SlidersHorizontal size={17} aria-hidden="true" /> Filtros
        {active > 0 && <span className="filter-count" aria-label={`${active} filtros activos`}>{active}</span>}
      </button>
      <dialog ref={panel} open id="catalog-filters" className="filter-dialog" aria-labelledby="catalog-filter-title"
        onKeyDown={event => {
          if (event.key !== 'Tab' || !event.currentTarget.matches(':modal')) return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], summary, button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), [tabindex="0"]'))
            .filter(control => control.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        onClose={() => { if (!panel.current?.open && mobile.current && open) close(); }}>
        <form ref={form} action="/buscar" className="filter-form" onSubmit={validateRange} aria-busy={pending}
          onInput={event => {
            const element = event.currentTarget.elements.namedItem('max') as HTMLInputElement | null;
            element?.setCustomValidity('');
            const values = new FormData(event.currentTarget);
            setDirty(JSON.stringify(fields.map(name => String(values.get(name) ?? ''))) !== JSON.stringify(applied));
          }}>
          <header className="filter-heading">
            <h2 id="catalog-filter-title"><SlidersHorizontal size={18} aria-hidden="true" /> Filtros</h2>
            {clearHref && <Link prefetch={false} href={clearHref}>Limpiar filtros</Link>}
            <button type="button" className="filter-close" aria-label="Cerrar filtros sin aplicar" onClick={close}><X size={20} aria-hidden="true" /></button>
          </header>
          <p className="filter-draft" role="status">{pending ? 'Actualizando productos…' : dirty ? 'Cambios pendientes de aplicar' : active ? 'Filtros aplicados' : 'Ajusta los filtros y pulsa Aplicar'}</p>
          <div className="filter-body">{children}</div>
          <footer className="filter-actions">
            <button type="button" className="button secondary filter-cancel" onClick={close}>Cancelar</button>
            <button className="button" type="submit">Aplicar filtros</button>
          </footer>
        </form>
      </dialog>
      <noscript><style>{`
        @media (max-width: 900px) {
          .search-page .search-layout { display: flex; flex-direction: column; }
          .search-page .search-layout > * { width: 100%; }
          .search-page .search-sidebar #catalog-filters[open] {
            display: block; position: static; max-height: none; width: 100%; margin: 0;
          }
          .search-page .filter-form { max-height: none; }
          .search-page .filter-toggle, .search-page .filter-close, .search-page .filter-cancel { display: none; }
        }
      `}</style></noscript>
    </aside>
  );
}
