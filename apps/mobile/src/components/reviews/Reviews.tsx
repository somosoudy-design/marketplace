import type { PublicReview, ReviewSummary } from '@kora/api';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { formatRating, shortDate } from '@/lib/format';
import { useTheme } from '@/theme';

/** Read-only stars; half values round to the nearest half star. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const t = useTheme();
  const rounded = Math.round(value * 2) / 2;
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${formatRating(value)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = rounded >= i;
        const half = !full && rounded >= i - 0.5;
        return (
          <View key={i} style={{ width: size, height: size }}>
            <Icon name="star" size={size} color={t.colors.borderStrong} fill={t.colors.surfaceSunken} />
            {full || half ? (
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: full ? size : size / 2, overflow: 'hidden' }}>
                <Icon name="star" size={size} color={t.colors.accent} fill={t.colors.accent} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Tappable 1–5 input with a word for the chosen value, so the scale is unambiguous. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const words = ['', 'Muy malo', 'Malo', 'Aceptable', 'Bueno', 'Excelente'];
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((i) => (
          <ScalePressable
            key={i}
            testID={`star-${i}`}
            accessibilityRole="radio"
            accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
            aria-checked={value === i}
            hitSlop={4}
            scaleTo={0.85}
            onPress={() => {
              haptics.select();
              onChange(i);
            }}
          >
            <Icon name="star" size={36} color={i <= value ? t.colors.accent : t.colors.borderStrong} fill={i <= value ? t.colors.accent : 'none'} strokeWidth={1.6} />
          </ScalePressable>
        ))}
      </View>
      <Text variant="label" color={value ? 'text' : 'textMuted'}>{value ? words[value] : 'Toca para calificar'}</Text>
    </View>
  );
}

/** Average, count and distribution bars. Shown only when real reviews exist. */
export function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const t = useTheme();
  const total = Math.max(summary.count, 1);
  return (
    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 4, minWidth: 86 }}>
        <Text variant="displayL" tabular>{formatRating(summary.avg ?? 0)}</Text>
        <Stars value={Number(summary.avg ?? 0)} />
        <Text variant="caption" color="textMuted">{summary.count === 1 ? '1 opinión' : `${summary.count} opiniones`}</Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        {(['5', '4', '3', '2', '1'] as const).map((k) => {
          const n = summary.distribution[k] ?? 0;
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`${k} estrellas: ${n}`}>
              <Text variant="caption" color="textMuted" tabular style={{ width: 10 }}>{k}</Text>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceSunken, overflow: 'hidden' }}>
                <View style={{ width: `${(n / total) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: t.colors.accent }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ReviewItem({ review: r, showProduct, storeName }: { review: PublicReview; showProduct?: boolean; storeName?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }} testID={`review-${r.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Stars value={r.rating} size={13} />
        <Text variant="caption" color="textMuted">{shortDate(r.created_at)}</Text>
      </View>
      {r.body ? <Text>{r.body}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Text variant="caption" color="textMuted">{r.author} ·</Text>
        <Icon name="badge-check" size={13} color={t.colors.success} />
        <Text variant="caption" color="success">Compra verificada</Text>
        <Text variant="caption" color="textMuted">
          {r.variant_title ? `· ${r.variant_title}` : ''}{showProduct && r.product_title ? ` · ${r.product_title}` : ''}{r.is_demo ? ' · Demostración' : ''}
        </Text>
      </View>
      {r.reply_body ? (
        <View style={{ marginTop: 4, padding: 12, borderRadius: t.radii.md, backgroundColor: t.colors.surfaceSunken, gap: 2 }} testID={`review-reply-${r.id}`}>
          <Text variant="label">Respuesta de {storeName ?? 'la tienda'}</Text>
          <Text variant="bodySmall" color="textSecondary">{r.reply_body}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Inline "★ 4,6 · 12 opiniones"; renders nothing until there is at least one real review. */
export function RatingInline({ avg, count, onPress }: { avg: number | null; count: number; onPress?: () => void }) {
  const t = useTheme();
  if (!count || avg == null) return null;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name="star" size={14} color={t.colors.accent} fill={t.colors.accent} />
      <Text variant="label" tabular>{formatRating(avg)}</Text>
      <Text variant="caption" color="textMuted">· {count === 1 ? '1 opinión' : `${count} opiniones`}</Text>
    </View>
  );
  return onPress ? (
    <ScalePressable accessibilityRole="button" accessibilityLabel={`${formatRating(avg)} de 5, ${count} opiniones. Ver opiniones`} onPress={onPress} hitSlop={6}>
      {body}
    </ScalePressable>
  ) : (
    body
  );
}
