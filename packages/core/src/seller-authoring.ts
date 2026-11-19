import { z } from 'zod';

// Validate explicit writes only. Reading or omitting legacy metadata never normalizes it.
const optionText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0, 'Escribe un valor.');
const normalizedKey = (value: string) => value.trim().toLowerCase();
export const sellerOptionNamesSchema = z
  .array(optionText(40))
  .max(10)
  .superRefine((names, ctx) => {
    if (new Set(names.map(normalizedKey)).size !== names.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No repitas nombres de opciones.' });
    }
  });
export const sellerVariantOptionsSchema = z.record(optionText(40), optionText(80)).superRefine((options, ctx) => {
  const keys = Object.keys(options);
  if (keys.length > 10 || new Set(keys.map(normalizedKey)).size !== keys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Revisa los nombres de las opciones.' });
  }
});
/** Opaque server revision: never replace it with products.updated_at or a client clock. */
export const sellerRevisionSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Actualiza el producto antes de guardar.');

const finite = z.number().finite();
/** Validate before JSON serialization: Infinity/NaN otherwise become null and could mean unlimited stock. */
export const sellerNumericChangesSchema = z
  .object({
    fields: z
      .object({
        weight_kg: finite.nonnegative().optional(),
        compare_at_usd: finite.positive().nullable().optional(),
        max_per_order: finite.int().min(1).max(100).optional(),
      })
      .passthrough()
      .optional(),
    variants: z
      .array(
        z
          .object({
            price_usd: finite.positive().optional(),
            stock: finite.int().nonnegative().max(2147483647).nullable().optional(),
            sort: finite.int().optional(),
          })
          .passthrough(),
      )
      .optional(),
    images: z.array(z.object({ sort: finite.int().optional(), remove: z.literal(true).optional() }).passthrough().superRefine((image, ctx) => {
      if (image.remove && Object.keys(image).some((key) => key !== 'id' && key !== 'remove')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quitar una foto no admite otros cambios en la misma entrada.' });
      }
    })).optional(),
    costs: z
      .object({
        freight_usd: finite.nonnegative().nullable().optional(),
        logistics_usd: finite.nonnegative().nullable().optional(),
        margin_pct: finite.min(0).max(500).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    variantCosts: z.array(z.object({ cost_usd: finite.positive().nullable() }).passthrough()).optional(),
  })
  .passthrough();
