'use client';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// ---------- layout ----------
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</p> : null}
        <h1 className="font-display text-[30px] leading-tight font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[15px] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className, title, actions, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('rounded-[20px] border border-line bg-surface', className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default', href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warning' | 'danger' | 'brand'; href?: string }) {
  const inner = (
    <div className={cx('h-full rounded-[20px] border border-line bg-surface p-5 transition-colors', href && 'hover:border-line-strong')}>
      <p className="text-[13px] font-semibold text-ink-3">{label}</p>
      <p className={cx('tabular mt-1 text-[28px] font-bold leading-tight', tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : tone === 'brand' ? 'text-brand' : 'text-ink')}>{value}</p>
      {hint ? <p className="mt-1 text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ---------- controls ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: LucideIcon };
const buttonClass = (variant: BtnVariant, size: 'sm' | 'md', className?: string) => cx(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background,box-shadow,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-5 text-sm',
  variant === 'primary' && 'bg-brand text-on-brand hover:bg-brand-pressed',
  variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  variant === 'ghost' && 'text-ink-2 hover:bg-sunken',
  variant === 'danger' && 'bg-danger text-white hover:opacity-90',
  className,
);
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', loading, icon: I, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading ? <LoaderCircle size={16} className="animate-spin" /> : I ? <I size={16} /> : null}
      {children}
    </button>
  );
});

/** A navigation link that looks like a button (never a button inside a link). */
export function LinkButton({ href, variant = 'primary', size = 'md', icon: I, className, children }: { href: string; variant?: BtnVariant; size?: 'sm' | 'md'; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {I ? <I size={16} /> : null}
      {children}
    </Link>
  );
}

const fieldBase = 'w-full rounded-[14px] border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx(fieldBase, 'h-10', className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} {...rest} className={cx(fieldBase, 'min-h-24 py-2.5', className)} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} {...rest} className={cx(fieldBase, 'h-10 pr-8', className)}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  // The label names the control; hint and error describe it (kept out of the accessible name).
  const msgId = `${useId()}-msg`;
  const message = error || hint;
  const control = isValidElement(children) && message
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, { 'aria-describedby': msgId, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        {control}
      </label>
      {error ? <span id={msgId} className="text-[12.5px] font-medium text-danger">{error}</span> : hint ? <span id={msgId} className="text-[12.5px] text-ink-3">{hint}</span> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-line-strong')}
    >
      <span className={cx('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="mb-5 flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cx('inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold transition-colors', value === i.value ? 'border-ink bg-ink text-surface' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}
        >
          {i.label}
          {i.count != null ? <span className={cx('tabular rounded-full px-1.5 text-[12px]', value === i.value ? 'bg-surface/20' : 'bg-sunken')}>{i.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------- feedback ----------
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'editorial';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  editorial: 'bg-editorial-soft text-editorial',
};
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold', toneClass[tone], className)}>{children}</span>;
}

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cx('rounded-[14px] px-4 py-3 text-sm', toneClass[tone])}>
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className={cx(title && 'mt-0.5', 'opacity-90')}>{children}</div> : null}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-md text-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-5" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-[10px] bg-sunken" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="p-5">
      <Notice tone="danger" title="No pudimos cargar esta información">
        <p>{error instanceof Error ? error.message : 'Intenta de nuevo.'}</p>
        {onRetry ? <button onClick={onRetry} className="mt-2 font-bold underline">Reintentar</button> : null}
      </Notice>
    </div>
  );
}

// ---------- table ----------
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-3">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 font-bold first:pl-5 last:pr-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, className, ...rest }: { children?: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={cx('px-4 py-3 align-middle first:pl-5 last:pr-5', className)}>{children}</td>;
}

// ---------- dialog ----------
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={cx('m-auto w-[min(94vw,520px)] rounded-[24px] border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[var(--overlay)]', wide && 'w-[min(94vw,860px)]')}
    >
      {open ? (
        <div className="flex max-h-[86vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="rounded-full px-2 text-2xl leading-none text-ink-3 hover:text-ink">×</button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function Thumb({ src, alt, size = 44 }: { src: string | null | undefined; alt: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size * 1.25} className="shrink-0 rounded-[10px] bg-sunken object-cover" style={{ width: size, height: size * 1.25 }} />
  ) : (
    <div className="shrink-0 rounded-[10px] bg-sunken" style={{ width: size, height: size * 1.25 }} />
  );
}
