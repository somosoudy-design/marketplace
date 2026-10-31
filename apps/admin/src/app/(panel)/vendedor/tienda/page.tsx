'use client';
import { storeAccents } from '@kora/design-tokens';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Field, Input, PageHeader, Textarea, cx } from '@/components/ui';
import { kora, run, db, storeImage } from '@/lib/kora';
import { useStore, type StoreRow } from '@/lib/store';

type Accent = keyof typeof storeAccents;
const ACCENT_LABEL: Record<Accent, string> = { jade: 'Jade', amber: 'Ámbar', coral: 'Coral', plum: 'Ciruela', ink: 'Tinta', sky: 'Cielo' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS: Record<StoreRow['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Activa', tone: 'success' }, pending: { label: 'En revisión', tone: 'warning' }, suspended: { label: 'Suspendida', tone: 'danger' },
};

export default function StoreProfile() {
  const { store } = useStore();
  return <ProfileForm key={store!.id} store={store!} />;
}

function ProfileForm({ store: s }: { store: StoreRow }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: s.name, tagline: s.tagline ?? '', description: s.description ?? '', shipping_info: s.shipping_info ?? '', contact_email: s.contact_email ?? '',
    returns: s.policies?.returns ?? '', warranty: s.policies?.warranty ?? '', accent: (s.accent ?? 'jade') as Accent,
  });
  const [files, setFiles] = useState<{ logo?: File; cover?: File }>({});
  const preview = (k: 'logo' | 'cover') => (files[k] ? URL.createObjectURL(files[k]!) : storeImage(k === 'logo' ? s.logo_path : s.cover_path));
  const errors = {
    name: f.name.trim().length < 2 || f.name.trim().length > 60 ? 'Entre 2 y 60 caracteres.' : null,
    contact_email: f.contact_email.trim() && !EMAIL.test(f.contact_email.trim()) ? 'Correo inválido.' : null,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (errors.name || errors.contact_email) throw new Error('Revisa los campos marcados.');
      const { client } = kora();
      const paths: Record<string, string> = {};
      for (const k of ['logo', 'cover'] as const) {
        const file = files[k];
        if (!file) continue;
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${s.id}/${k}-${Date.now()}.${ext}`;
        const { error } = await client.storage.from('stores').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
        paths[`${k}_path`] = path;
      }
      const policies = { ...(s.policies ?? {}), returns: f.returns.trim(), warranty: f.warranty.trim() };
      await run(db('stores').update({
        name: f.name.trim(), tagline: f.tagline.trim() || null, description: f.description.trim() || null, shipping_info: f.shipping_info.trim() || null,
        contact_email: f.contact_email.trim() || null, accent: f.accent, policies: Object.fromEntries(Object.entries(policies).filter(([, v]) => v)), ...paths,
      }).eq('id', s.id));
    },
    onSuccess: () => { setFiles({}); qc.invalidateQueries({ queryKey: ['my-stores'] }); toast.ok('Perfil actualizado.'); },
    onError: toast.error,
  });

  const pick = (k: 'logo' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(new Error('La imagen debe pesar menos de 5 MB.'));
    setFiles((x) => ({ ...x, [k]: file }));
  };

  return (
    <>
      <PageHeader eyebrow={s.name} title="Perfil de la tienda" description="Así te ven los compradores en la app. Para mantener la experiencia coherente, la personalización usa una paleta de acentos curada." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" error={errors.name}><Input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Correo de contacto" error={errors.contact_email} hint="Visible para compradores con pedidos en tu tienda."><Input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></Field>
            <Field label="Frase corta" hint={`${f.tagline.length}/90`} className="md:col-span-2"><Input value={f.tagline} maxLength={90} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="Lámparas y textiles hechos en Mérida" /></Field>
            <Field label="Descripción" hint={`${f.description.length}/2000`} className="md:col-span-2"><Textarea rows={4} maxLength={2000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label="Información de envío" className="md:col-span-2"><Textarea rows={2} value={f.shipping_info} onChange={(e) => setF({ ...f, shipping_info: e.target.value })} placeholder="Despachamos de lunes a viernes por MRW o Zoom." /></Field>
            <Field label="Política de cambios y devoluciones"><Textarea rows={3} value={f.returns} onChange={(e) => setF({ ...f, returns: e.target.value })} /></Field>
            <Field label="Garantía"><Textarea rows={3} value={f.warranty} onChange={(e) => setF({ ...f, warranty: e.target.value })} /></Field>
          </div>
          <fieldset className="mt-5">
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">Color de acento</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {(Object.keys(storeAccents) as Accent[]).map((a) => (
                <button key={a} type="button" role="radio" aria-checked={f.accent === a} onClick={() => setF({ ...f, accent: a })}
                  className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold', f.accent === a ? 'border-ink text-ink' : 'border-line-strong text-ink-2')}>
                  <span className="size-4 rounded-full" style={{ background: storeAccents[a] }} />{ACCENT_LABEL[a]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex justify-end border-t border-line pt-4">
            <Button loading={save.isPending} onClick={() => save.mutate()}>Guardar perfil</Button>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Vista previa" padded={false}>
            <div className="relative aspect-[16/9] overflow-hidden rounded-t-none" style={{ background: storeAccents[f.accent] }}>
              {preview('cover') ? <img src={preview('cover')!} alt="" className="size-full object-cover" /> : null}
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="size-12 shrink-0 overflow-hidden rounded-[14px] border border-line" style={{ background: storeAccents[f.accent] }}>
                {preview('logo') ? <img src={preview('logo')!} alt="" className="size-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{f.name || 'Tu tienda'}</p>
                <p className="truncate text-[13px] text-ink-3">{f.tagline || 'Frase corta'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              <ImageButton label="Cambiar logo" onChange={pick('logo')} />
              <ImageButton label="Cambiar portada" onChange={pick('cover')} />
            </div>
          </Card>
          <Card title="Estado">
            <div className="flex items-center justify-between text-sm"><span className="text-ink-2">Tienda</span><Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge></div>
            <div className="mt-2 flex items-center justify-between text-sm"><span className="text-ink-2">Dirección en la app</span><span className="font-mono text-[12.5px]">/store/{s.slug}</span></div>
            {s.rating_count ? <div className="mt-2 flex items-center justify-between text-sm"><span className="text-ink-2">Valoración</span><span className="tabular font-semibold">{Number(s.rating_avg).toFixed(1)} · {s.rating_count} opiniones</span></div> : null}
            <p className="mt-3 text-[12.5px] text-ink-3">El estado y la dirección los gestiona la administración.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function ImageButton({ label, onChange }: { label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink">
      <ImagePlus size={15} /> {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} />
    </label>
  );
}
