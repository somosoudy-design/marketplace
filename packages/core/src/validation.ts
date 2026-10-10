import { z } from 'zod';

export const VE_PHONE = /^(\+?58\s?)?0?(2\d{2}|4(12|14|16|22|24|26))[\s-]?\d{3}[\s-]?\d{4}$/;
export const VE_ID = /^[VEJGP]-?\d{5,10}$/i;

export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Ponle un nombre, por ejemplo Casa').max(40),
  recipient: z.string().trim().min(3, 'Escribe el nombre de quien recibe').max(120),
  phone: z.string().trim().regex(VE_PHONE, 'Teléfono venezolano válido, por ejemplo 0412 123 4567'),
  region_code: z.string().min(1, 'Elige el estado'),
  city: z.string().trim().min(2, 'Escribe la ciudad').max(80),
  municipality: z.string().trim().max(80).optional().nullable(),
  line1: z.string().trim().min(5, 'Escribe la dirección').max(200),
  reference: z.string().trim().max(200).optional().nullable(),
  id_document: z.string().trim().regex(VE_ID, 'Cédula o RIF, por ejemplo V-12345678').optional().nullable().or(z.literal('')),
  is_default: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const signUpSchema = z.object({
  full_name: z.string().trim().min(3, 'Escribe tu nombre').max(120),
  email: z.string().trim().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Za-z]/, 'Incluye letras').regex(/\d/, 'Incluye números'),
});
/** First password problem in Spanish, or null when the password is acceptable. */
export function validatePassword(pw: string): string | null {
  const r = signUpSchema.shape.password.safeParse(pw);
  return r.success ? null : (r.error.issues[0]?.message ?? 'Contraseña inválida');
}

/** Same normalization the database applies before checking a reference (spaces and dashes are ignored). */
export const normalizeReference = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const signInSchema = z.object({ email: z.string().trim().email('Correo inválido'), password: z.string().min(1, 'Escribe tu contraseña') });

export const paymentSubmissionSchema = (opts: { requiresReference: boolean; pattern?: string | null; requiresProof: boolean }) =>
  z.object({
    reference: opts.requiresReference
      ? z.string().trim().min(4, 'Escribe la referencia').refine((v) => !opts.pattern || new RegExp(opts.pattern).test(v.replace(/[^A-Za-z0-9]/g, '')), 'Formato de referencia inválido')
      : z.string().trim().optional(),
    proofPath: opts.requiresProof ? z.string().min(1, 'Adjunta el comprobante') : z.string().optional().nullable(),
    payerName: z.string().trim().max(120).optional(),
    payerBank: z.string().trim().max(80).optional(),
  });

export const productFormSchema = z.object({
  title: z.string().trim().min(3).max(140),
  subtitle: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().max(8000).optional().nullable(),
  category_id: z.string().uuid(),
  availability: z.enum(['available', 'on_order', 'in_transit', 'reservable', 'sold_out', 'unavailable']),
  weight_kg: z.coerce.number().min(0).max(500),
  max_per_order: z.coerce.number().int().min(1).max(100),
  variants: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(60),
    price_usd: z.coerce.number().positive().max(100000),
    stock: z.coerce.number().int().min(0).nullable(),
    sku: z.string().trim().max(60).optional().nullable(),
  })).min(1),
});

export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function validateUpload(file: { type?: string | null; size?: number | null }): string | null {
  if (!file.type || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) return 'Formato no permitido. Usa JPG, PNG, WebP o PDF.';
  if (!file.size || file.size > MAX_UPLOAD_BYTES) return 'El archivo supera 5 MB.';
  return null;
}
