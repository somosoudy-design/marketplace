'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from '@kora/api';
import { addressSchema, type AddressInput } from '@kora/core';
import { browser } from '@/lib/browser';
import { QueryError } from './buyer';
const blank: AddressInput = {
  label: 'Casa',
  recipient: '',
  phone: '',
  region_code: '',
  city: '',
  municipality: '',
  line1: '',
  reference: '',
  id_document: '',
  is_default: false,
};
export function AddressEditor({
  buyerId,
  address,
  first,
  onDone,
  onCancel,
}: {
  buyerId: string;
  address?: Address;
  first?: boolean;
  onDone: (a: Address) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddressInput>(
    address
      ? {
          ...address,
          municipality: address.municipality ?? '',
          reference: address.reference ?? '',
          id_document: address.id_document ?? '',
        }
      : { ...blank, is_default: !!first },
  );
  const [problem, setProblem] = useState('');
  const qc = useQueryClient();
  const regions = useQuery({ queryKey: ['regions'], queryFn: () => browser().api.account.regions() });
  const save = useMutation({
    mutationFn: async () => {
      const value = addressSchema.safeParse(form);
      if (!value.success) throw new Error(value.error.issues[0]?.message);
      return browser().api.account.saveAddress({
        ...value.data,
        id: address?.id,
        user_id: buyerId,
        country_code: 'VE',
        municipality: value.data.municipality || null,
        reference: value.data.reference || null,
        id_document: value.data.id_document?.toUpperCase() || null,
      });
    },
    onSuccess: async (a) => {
      await qc.invalidateQueries({ queryKey: ['addresses', buyerId] });
      onDone(a);
    },
  });
  const fields = [
    ['label', 'Nombre de la dirección'],
    ['recipient', 'Quien recibe'],
    ['phone', 'Teléfono'],
    ['region_code', 'Estado'],
    ['city', 'Ciudad'],
    ['municipality', 'Municipio'],
    ['line1', 'Dirección'],
    ['reference', 'Referencia de ubicación'],
    ['id_document', 'Cédula o RIF'],
  ] as const;
  return (
    <form
      method="post"
      className="commerce-form"
      onSubmit={(e) => {
        e.preventDefault();
        setProblem('');
        if (!save.isPending) save.mutate();
      }}
    >
      <h2>{address ? 'Editar dirección' : 'Nueva dirección'}</h2>
      <div className="form-grid">
        {fields.map(([field, label]) =>
          field === 'region_code' ? (
            <label key={field}>
              Estado
              <select
                name="region_code"
                aria-label="Estado"
                required
                disabled={save.isPending || !regions.data}
                value={form.region_code}
                onChange={(e) => setForm({ ...form, region_code: e.target.value, city: '' })}
              >
                <option value="">Seleccionar estado</option>
                {regions.data?.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label key={field}>
              {label}
              <input
                name={field}
                required={['label', 'recipient', 'phone', 'city', 'line1'].includes(field)}
                maxLength={field === 'line1' || field === 'reference' ? 200 : 120}
                type={field === 'phone' ? 'tel' : 'text'}
                autoComplete={
                  field === 'recipient'
                    ? 'name'
                    : field === 'phone'
                      ? 'tel'
                      : field === 'city'
                        ? 'address-level2'
                        : field === 'line1'
                          ? 'street-address'
                          : 'off'
                }
                disabled={save.isPending}
                value={String(form[field] ?? '')}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </label>
          ),
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.is_default ?? false}
            disabled={save.isPending}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />
          Usar como dirección principal
        </label>
      </div>
      {regions.isError && <QueryError error={regions.error} retry={() => regions.refetch()} />}
      {(problem || save.isError) && (
        <p role="alert" className="error">
          {problem || save.error?.message}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={save.isPending || !regions.isSuccess}>
          {save.isPending ? 'Guardando…' : 'Guardar dirección'}
        </button>
        <button type="button" className="button secondary" disabled={save.isPending} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
export function Addresses({ buyerId }: { buyerId: string }) {
  const data = useQuery({
    queryKey: ['addresses', buyerId],
    queryFn: () => browser().api.account.addressesForBuyer(buyerId),
  });
  const qc = useQueryClient();
  const [editor, setEditor] = useState<Address | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => browser().api.account.deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses', buyerId] }),
  });
  return (
    <div className="wrap commerce-page">
      <div className="section-heading">
        <h1>Mis direcciones</h1>
        {!editor && (
          <button className="button" onClick={() => setEditor('new')}>
            Agregar dirección
          </button>
        )}
      </div>
      {data.isPending && <p role="status">Cargando direcciones…</p>}
      {data.isError && <QueryError error={data.error} retry={() => data.refetch()} />}
      {editor ? (
        <AddressEditor
          buyerId={buyerId}
          address={editor === 'new' ? undefined : editor}
          first={!data.data?.length}
          onDone={() => setEditor(null)}
          onCancel={() => setEditor(null)}
        />
      ) : (
        <div className="address-list">
          {data.data?.length === 0 && <p>Añade una dirección para consultar las opciones de entrega.</p>}
          {data.data?.map((a) => (
            <article className="address-row" key={a.id}>
              <div>
                <h2>
                  {a.label}
                  {a.is_default ? ' · Principal' : ''}
                </h2>
                <p>
                  {a.recipient} · {a.phone}
                </p>
                <p>
                  {a.line1}, {a.city}
                </p>
              </div>
              <div className="form-actions">
                <button className="button secondary" disabled={remove.isPending} onClick={() => setEditor(a)}>
                  Editar
                </button>
                <button
                  className="text-button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`¿Eliminar la dirección ${a.label}?`)) remove.mutate(a.id);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {remove.isError && (
        <QueryError
          error={remove.error}
          retry={() => {
            const address = data.data?.find((a) => a.id === remove.variables);
            if (address && !remove.isPending && window.confirm(`¿Eliminar la dirección ${address.label}?`))
              remove.mutate(address.id);
            else if (!address) {
              remove.reset();
              void data.refetch();
            }
          }}
        />
      )}
    </div>
  );
}
