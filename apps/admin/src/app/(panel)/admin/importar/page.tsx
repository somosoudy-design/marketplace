'use client';
import { AVAILABILITY, type Availability } from '@kora/core';
import { providerName, type ExtractedProduct } from '@kora/core/import';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe, ImagePlus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Td, Textarea, type Tone } from '@/components/ui';
import { ago } from '@/lib/format';
import { useCategoriesIndex, useStoresIndex } from '@/lib/hooks';
import { apiPost, db, kora, run } from '@/lib/kora';

type ImportStatus = 'pending' | 'extracted' | 'manual_required' | 'failed' | 'published';
interface ImportRow {
  id: string;
  url: string;
  provider: string | null;
  status: ImportStatus;
  extracted: ExtractedProduct | null;
  message: string | null;
  product_id: string | null;
  created_at: string;
}
interface Provider { key: string; name: string; policy: 'metadata' | 'manual'; note: string }

const STATUS: Record<ImportStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Leyendo', tone: 'info' },
  extracted: { label: 'Listo para revisar', tone: 'brand' },
  manual_required: { label: 'Carga manual', tone: 'warning' },
  failed: { label: 'Sin datos legibles', tone: 'danger' },
  published: { label: 'Producto creado', tone: 'success' },
};
const SALE_AVAILABILITY: Availability[] = ['on_order', 'available', 'reservable', 'in_transit'];
const PRICE = /^\d{1,7}([.,]\d{1,2})?$/;

interface Draft {
  importId: string;
  url: string;
  provider: string | null;
  title: string;
  subtitle: string;
  description: string;
  storeId: string;
  categoryId: string;
  price: string;
  compareAt: string;
  availability: Availability;
  weight: string;
  variants: { title: string; price: string; sku: string }[];
  images: { url: string; include: boolean; rights: boolean }[];
  files: { file: File; preview: string; rights: boolean }[];
  refPrice: number | null;
  refCurrency: string | null;
}

function draftFrom(row: ImportRow, storeId: string): Draft {
  const x = row.extracted;
  return {
    importId: row.id,
    url: row.url,
    provider: row.provider,
    title: (x?.title ?? '').slice(0, 140),
    subtitle: x?.brand ? x.brand.slice(0, 140) : '',
    description: (x?.description ?? '').slice(0, 8000),
    storeId,
    categoryId: '',
    price: '',
    compareAt: '',
    availability: 'on_order',
    weight: '0.5',
    variants: (x?.variants ?? []).slice(0, 20).map((v) => ({ title: v.title.slice(0, 80), price: '', sku: v.sku ?? '' })),
    images: (x?.images ?? []).map((url) => ({ url, include: true, rights: false })),
    files: [],
    refPrice: x?.price ?? null,
    refCurrency: x?.currency ?? null,
  };
}

const host = (u: string) => {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.slice(0, 48) + (x.pathname.length > 48 ? '…' : '') : '');
  } catch {
    return u;
  }
};

export default function ImportPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const stores = useStoresIndex();
  const cats = useCategoriesIndex();
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<{ productId: string; title: string } | null>(null);
  const platformStore = stores.list.find((s) => s.kind === 'platform')?.id ?? stores.list[0]?.id ?? '';

  const recent = useQuery({
    queryKey: ['url-imports'],
    queryFn: () => run<ImportRow[]>(db('url_imports').select('id, url, provider, status, extracted, message, product_id, created_at').order('created_at', { ascending: false }).limit(30)),
  });

  const read = useMutation({
    mutationFn: (u: string) => apiPost<{ import: ImportRow; provider: Provider }>('/api/import', { url: u }),
    onSuccess: (r) => {
      setProvider(r.provider);
      setCreated(null);
      setDraft(draftFrom(r.import, platformStore));
      qc.invalidateQueries({ queryKey: ['url-imports'] });
    },
    onError: toast.error,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) read.mutate(url.trim());
  };

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Importar por URL"
        description="Leemos solo la página que pegues y solo los datos que publica para vistas previas. Las tiendas que prohíben la extracción automática se cargan a mano. El precio de venta lo fijas tú y el producto entra a moderación."
      />
      <Card className="mb-5">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field label="Enlace del producto" className="min-w-[280px] flex-1">
            <Input type="url" inputMode="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Enlace del producto" />
          </Field>
          <Button type="submit" icon={Globe} loading={read.isPending}>Leer página</Button>
        </form>
      </Card>

      {created ? (
        <div className="mb-5">
          <Notice tone="success" title="Producto creado y enviado a moderación">
            «{created.title}» quedó pendiente. Revísalo y publícalo desde{' '}
            <Link href="/admin/productos" className="font-semibold underline">Productos y moderación</Link>.
          </Notice>
        </div>
      ) : null}

      {draft ? (
        <DraftEditor
          key={draft.importId}
          initial={draft}
          provider={provider}
          status={recent.data?.find((r) => r.id === draft.importId)?.status}
          message={recent.data?.find((r) => r.id === draft.importId)?.message ?? null}
          stores={stores.list}
          categories={cats.list}
          onCancel={() => setDraft(null)}
          onCreated={(productId, title) => {
            setDraft(null);
            setCreated({ productId, title });
            setUrl('');
            qc.invalidateQueries({ queryKey: ['url-imports'] });
            qc.invalidateQueries({ queryKey: ['admin-products'] });
          }}
        />
      ) : null}

      <Card title="Importaciones recientes" padded={false}>
        {recent.isPending ? <Loading /> : recent.isError ? <ErrorBox error={recent.error} onRetry={() => recent.refetch()} /> : !recent.data.length ? (
          <Empty title="Aún no hay importaciones" body="Pega el enlace de un producto de un sitio oficial para empezar." />
        ) : (
          <Table head={['Enlace', 'Origen', 'Estado', 'Detalle', 'Fecha', '']}>
            {recent.data.map((r) => (
              <tr key={r.id}>
                <Td className="max-w-[320px]">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate font-medium hover:text-brand">
                    <span className="truncate">{host(r.url)}</span>
                    <ExternalLink size={13} className="shrink-0 text-ink-3" />
                  </a>
                </Td>
                <Td className="whitespace-nowrap">{providerName(r.provider)}</Td>
                <Td><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></Td>
                <Td className="max-w-[300px] text-ink-2"><span className="line-clamp-2">{r.status === 'extracted' ? r.extracted?.title ?? '—' : r.message ?? '—'}</span></Td>
                <Td className="whitespace-nowrap text-ink-3">{ago(r.created_at)}</Td>
                <Td className="whitespace-nowrap text-right">
                  {r.status === 'published' ? (
                    <Link href="/admin/productos" className="text-sm font-semibold text-brand">Ver en moderación</Link>
                  ) : r.status !== 'pending' ? (
                    <Button size="sm" variant="secondary" onClick={() => { setCreated(null); setProvider(null); setDraft(draftFrom(r, platformStore)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      {r.status === 'extracted' ? 'Revisar' : 'Completar a mano'}
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function DraftEditor({
  initial, provider, status, message, stores, categories, onCancel, onCreated,
}: {
  initial: Draft;
  provider: Provider | null;
  status?: ImportStatus;
  message: string | null;
  stores: { id: string; name: string; kind: string; status: string }[];
  categories: { id: string; name: string; parent_id: string | null; risk_level: string; requires_review: boolean; active: boolean }[];
  onCancel: () => void;
  onCreated: (productId: string, title: string) => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  useEffect(() => () => d.files.forEach((f) => URL.revokeObjectURL(f.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const catOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .filter((c) => c.active)
      .map((c) => ({ id: c.id, label: c.parent_id ? `${byId.get(c.parent_id)?.name ?? ''} › ${c.name}` : c.name, sensitive: c.requires_review || c.risk_level !== 'low' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [categories]);

  const included = d.images.filter((i) => i.include);
  const errors = {
    title: d.title.trim().length < 3 ? 'Escribe un título de al menos 3 caracteres.' : null,
    storeId: !d.storeId ? 'Elige la tienda que venderá el producto.' : null,
    categoryId: !d.categoryId ? 'Elige una categoría.' : null,
    price: !PRICE.test(d.price.trim()) || Number(d.price.replace(',', '.')) <= 0 ? 'Indica nuestro precio de venta en USD (hasta 2 decimales).' : null,
    compareAt: d.compareAt.trim() && (!PRICE.test(d.compareAt.trim()) || Number(d.compareAt.replace(',', '.')) <= Number(d.price.replace(',', '.'))) ? 'Debe ser mayor que el precio de venta.' : null,
    weight: !/^\d{1,3}([.,]\d{1,3})?$/.test(d.weight.trim()) ? 'Peso inválido.' : null,
    variants: d.variants.some((v) => !v.title.trim() || (v.price.trim() && !PRICE.test(v.price.trim()))) ? 'Cada variante necesita un nombre y, si cambia el precio, un monto válido.' : null,
    rights: included.some((i) => !i.rights) || d.files.some((f) => !f.rights) ? 'Confirma los derechos de uso de cada imagen incluida, o quítala.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const sensitive = catOptions.find((c) => c.id === d.categoryId)?.sensitive;
  const num = (s: string) => s.trim().replace(',', '.');

  const create = useMutation({
    mutationFn: async () => {
      const { client } = kora();
      const uploaded: { path: string; alt: string; rightsConfirmed: true }[] = [];
      for (const [n, f] of d.files.entries()) {
        const ext = f.file.type === 'image/png' ? 'png' : f.file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${d.storeId}/imports/${d.importId}/propia-${Date.now()}-${n}.${ext}`;
        const { error } = await client.storage.from('catalog').upload(path, await f.file.arrayBuffer(), { contentType: f.file.type, upsert: true });
        if (error) throw new Error(`No se pudo subir la imagen ${n + 1}: ${error.message}`);
        uploaded.push({ path, alt: d.title.trim(), rightsConfirmed: true });
      }
      return apiPost<{ productId: string }>('/api/import/publish', {
        importId: d.importId,
        product: {
          store_id: d.storeId,
          category_id: d.categoryId,
          title: d.title.trim(),
          subtitle: d.subtitle.trim(),
          description: d.description.trim(),
          base_price_usd: num(d.price),
          compare_at_usd: d.compareAt.trim() ? num(d.compareAt) : '',
          availability: d.availability,
          weight_kg: num(d.weight),
        },
        variants: d.variants.map((v) => ({ title: v.title.trim(), sku: v.sku.trim(), price_usd: v.price.trim() ? num(v.price) : num(d.price) })),
        images: [...included.map((i) => ({ url: i.url, alt: d.title.trim(), rightsConfirmed: i.rights })), ...uploaded],
      });
    },
    onSuccess: (r) => onCreated(r.productId, d.title.trim()),
    onError: toast.error,
  });

  const st = status ?? (provider?.policy === 'manual' ? 'manual_required' : undefined);
  return (
    <Card
      className="mb-5"
      title={<span className="flex items-center gap-2">Borrador del producto {st ? <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge> : null}</span>}
      actions={<Button size="sm" variant="ghost" onClick={onCancel}>Cerrar</Button>}
    >
      <div className="mb-5 flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          Origen: <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-brand">{host(d.url)}</a>
          {provider ? <> · {provider.name}</> : d.provider ? <> · {providerName(d.provider)}</> : null}
        </p>
        {st === 'manual_required' ? (
          <Notice tone="warning" title="Este sitio se carga a mano">{message ?? provider?.note} No leemos sus páginas: copia los datos que necesites y sube imágenes propias o con licencia.</Notice>
        ) : st === 'failed' ? (
          <Notice tone="danger" title="No obtuvimos datos de la página">{message ?? 'Completa el borrador a mano.'}</Notice>
        ) : (
          <Notice tone="info">Revisa cada campo: los datos vienen de la página de origen y pueden estar incompletos. Reescribe la descripción con tus palabras.</Notice>
        )}
        {d.refPrice ? (
          <p className="text-[13px] text-ink-3">
            Precio que mostraba la página al leerla: <span className="tabular font-semibold text-ink-2">{d.refCurrency ?? ''} {d.refPrice}</span>. Es solo una referencia de costo; no se publica.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título" error={tried ? errors.title : null} className="md:col-span-2">
          <Input value={d.title} maxLength={140} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Subtítulo o marca" hint="Opcional, hasta 140 caracteres.">
          <Input value={d.subtitle} maxLength={140} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <Field label="Tienda que lo vende" error={tried ? errors.storeId : null}>
          <Select value={d.storeId} onChange={(e) => set('storeId', e.target.value)}>
            <option value="">Elegir tienda</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}{s.kind === 'platform' ? ' (plataforma)' : ''}{s.status !== 'active' ? ' · inactiva' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Descripción" hint={`${d.description.length}/8000`} className="md:col-span-2">
          <Textarea rows={5} value={d.description} maxLength={8000} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Categoría" error={tried ? errors.categoryId : null} hint={sensitive ? 'Categoría sensible: requiere revisión antes de publicarse.' : undefined}>
          <Select value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Elegir categoría</option>
            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}{c.sensitive ? ' · sensible' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Disponibilidad">
          <Select value={d.availability} onChange={(e) => set('availability', e.target.value as Availability)}>
            {SALE_AVAILABILITY.map((a) => <option key={a} value={a}>{AVAILABILITY[a].label}</option>)}
          </Select>
        </Field>
        <Field label="Nuestro precio de venta (USD)" error={tried ? errors.price : null}>
          <Input inputMode="decimal" className="tabular" placeholder="0.00" value={d.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label="Precio anterior (USD)" hint="Opcional. Solo si de verdad lo vendimos a ese precio." error={tried ? errors.compareAt : null}>
          <Input inputMode="decimal" className="tabular" value={d.compareAt} onChange={(e) => set('compareAt', e.target.value)} />
        </Field>
        <Field label="Peso estimado (kg)" hint="Se usa para cotizar el envío internacional." error={tried ? errors.weight : null}>
          <Input inputMode="decimal" className="tabular" value={d.weight} onChange={(e) => set('weight', e.target.value)} />
        </Field>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Variantes</h3>
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => set('variants', [...d.variants, { title: '', price: '', sku: '' }])}>Agregar variante</Button>
        </div>
        {!d.variants.length ? (
          <p className="text-sm text-ink-3">Sin variantes: se crea una única opción con el precio de venta.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {d.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_140px_auto] items-center gap-2">
                <Input aria-label={`Nombre de la variante ${i + 1}`} placeholder="Ej.: Negro / 65W" value={v.title} onChange={(e) => set('variants', d.variants.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input aria-label={`Precio de la variante ${i + 1}`} inputMode="decimal" className="tabular" placeholder={d.price || 'Precio'} value={v.price} onChange={(e) => set('variants', d.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <Input aria-label={`SKU de la variante ${i + 1}`} placeholder="SKU" value={v.sku} onChange={(e) => set('variants', d.variants.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} />
                <Button size="sm" variant="ghost" icon={Trash2} aria-label="Quitar variante" onClick={() => set('variants', d.variants.filter((_, j) => j !== i))} />
              </div>
            ))}
            {tried && errors.variants ? <p className="text-[12.5px] font-medium text-danger">{errors.variants}</p> : null}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Imágenes</h3>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">
            <ImagePlus size={16} /> Subir imagen propia
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])].filter((f) => f.size <= 5 * 1024 * 1024);
                if (files.length < (e.target.files?.length ?? 0)) toast.error(new Error('Las imágenes deben pesar menos de 5 MB.'));
                set('files', [...d.files, ...files.map((file) => ({ file, preview: URL.createObjectURL(file), rights: false }))].slice(0, 8));
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="mb-3 text-[13px] text-ink-3">Ninguna imagen se publica sin tu confirmación. Usa solo imágenes con licencia, del fabricante con permiso, o fotos propias. Se copian a nuestro almacenamiento; no enlazamos al sitio de origen.</p>
        {!d.images.length && !d.files.length ? (
          <p className="text-sm text-ink-3">Sin imágenes. Puedes crear el producto y agregarlas después.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {d.images.map((img, i) => (
              <ImageTile
                key={img.url}
                src={img.url}
                remote
                include={img.include}
                rights={img.rights}
                onInclude={(v) => set('images', d.images.map((x, j) => (j === i ? { ...x, include: v } : x)))}
                onRights={(v) => set('images', d.images.map((x, j) => (j === i ? { ...x, rights: v } : x)))}
              />
            ))}
            {d.files.map((f, i) => (
              <ImageTile
                key={f.preview}
                src={f.preview}
                include
                rights={f.rights}
                onInclude={() => { URL.revokeObjectURL(f.preview); set('files', d.files.filter((_, j) => j !== i)); }}
                onRights={(v) => set('files', d.files.map((x, j) => (j === i ? { ...x, rights: v } : x)))}
              />
            ))}
          </div>
        )}
        {tried && errors.rights ? <p className="mt-2 text-[12.5px] font-medium text-danger">{errors.rights}</p> : null}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13px] text-ink-3">El producto se crea como pendiente de moderación y no es visible para compradores hasta que lo publiques.</p>
        <Button
          loading={create.isPending}
          onClick={() => {
            setTried(true);
            if (valid) create.mutate();
          }}
        >
          Crear producto en moderación
        </Button>
      </div>
    </Card>
  );
}

function ImageTile({ src, remote, include, rights, onInclude, onRights }: { src: string; remote?: boolean; include: boolean; rights: boolean; onInclude: (v: boolean) => void; onRights: (v: boolean) => void }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border ${include ? 'border-line-strong' : 'border-line opacity-50'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" referrerPolicy="no-referrer" className="aspect-square w-full bg-sunken object-contain" />
      <div className="flex flex-col gap-1.5 p-2.5 text-[12.5px]">
        {include ? (
          <label className="flex items-start gap-2 font-medium text-ink">
            <input type="checkbox" checked={rights} onChange={(e) => onRights(e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />
            Confirmo derechos de uso
          </label>
        ) : null}
        <button type="button" className="self-start font-semibold text-ink-3 hover:text-danger" onClick={() => onInclude(!include)}>
          {remote ? (include ? 'No usar esta imagen' : 'Usar esta imagen') : 'Quitar'}
        </button>
      </div>
    </div>
  );
}
