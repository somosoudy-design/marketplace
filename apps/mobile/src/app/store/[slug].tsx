import type { StoreProfile } from '@kora/api';
import { storeAccents } from '@kora/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Catalog } from '@/components/catalog/Catalog';
import { MAX_CONTENT } from '@/components/catalog/ProductGrid';
import { RatingInline, ReviewItem } from '@/components/reviews/Reviews';
import { Badge } from '@/components/ui/Badge';
import { CollapsingHeader, useScrollY } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Divider, ListRow } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { monthYear } from '@/lib/format';
import { qk } from '@/lib/query';
import { api, storeImage } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const POLICY_LABEL: Record<string, string> = { returns: 'Devoluciones', warranty: 'Garantía', shipping: 'Envíos', invoices: 'Facturación', response_time: 'Tiempo de respuesta' };

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useQuery({ queryKey: qk.store(slug), queryFn: () => api.catalog.storeProfile(slug) });
  const s = q.data;
  const scroll = useScrollY();
  const coverHeight = Math.min(width, MAX_CONTENT) * (9 / 16);

  useEffect(() => {
    if (s?.id) void api.catalog.track('store_view', { storeId: s.id });
  }, [s?.id]);

  const back = <IconButton testID="store-back" icon="chevron-left" label="Volver" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;

  if (q.isError || (q.isSuccess && !s)) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 64, backgroundColor: t.colors.background }}>
        <View style={{ position: 'absolute', left: 16, top: insets.top + 8 }}>{back}</View>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <EmptyState icon="store" title="Esta tienda no está disponible" body="Puede estar en revisión o suspendida temporalmente." action="Explorar otras tiendas" onAction={() => router.navigate('/explore')} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Catalog
        key={slug}
        testID="store-catalog"
        initial={{ store: slug }}
        locked={['store']}
        header={<StoreHeader store={s} coverHeight={coverHeight} />}
        showSearch
        searchPlaceholder={s ? `Buscar en ${s.name}` : 'Buscar en esta tienda'}
        categorySlugs={s?.categories.map((c) => c.slug) ?? []}
        onScroll={scroll.onScroll}
      />
      <CollapsingHeader y={scroll.y} threshold={coverHeight} title={s?.name} left={back} />
    </View>
  );
}

function StoreHeader({ store: s, coverHeight }: { store: StoreProfile | null | undefined; coverHeight: number }) {
  const t = useTheme();
  const [info, setInfo] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const accent = s ? (storeAccents[s.accent as keyof typeof storeAccents] ?? t.colors.brand) : t.colors.surfaceSunken;
  const policies = Object.entries(s?.policies ?? {}).filter(([, v]) => !!v);
  const verified = s?.kind === 'platform' ? <Badge label="Tienda oficial" tone="brand" /> : <Badge label="Vendedor verificado" tone="info" />;

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ height: coverHeight, backgroundColor: accent }}>
        {s?.cover_path ? <Image source={{ uri: storeImage(s.cover_path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" transition={160} /> : null}
        {/* scrim so the overlapping logo and the back button always read over any cover */}
        <LinearGradient colors={['rgba(0,0,0,0.18)', 'transparent', 'transparent', t.colors.background]} locations={[0, 0.3, 0.7, 1]} style={{ position: 'absolute', inset: 0 }} />
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -40, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: t.colors.surface, padding: 4, ...t.elevation.low }}>
            {s?.logo_path ? <Image source={{ uri: storeImage(s.logo_path) ?? undefined }} style={{ flex: 1, borderRadius: 20 }} /> : <View style={{ flex: 1, borderRadius: 20, backgroundColor: accent }} />}
          </View>
        </View>

        {s ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="displayL" accessibilityRole="header">{s.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 6 }}>
                {verified}
                {s.rating_count > 0 ? <RatingInline avg={s.rating_avg} count={s.rating_count} /> : <Text variant="caption" color="textMuted">Aún sin opiniones</Text>}
                <Text variant="caption" color="textMuted">{s.product_count === 1 ? '1 producto' : `${s.product_count} productos`} · desde {monthYear(s.since)}</Text>
              </View>
            </View>

            {s.tagline ? <Text variant="subtitle" color="textSecondary">{s.tagline}</Text> : null}
            {s.description ? (
              <ScalePressable scaleTo={1} accessibilityRole="button" accessibilityLabel={expanded ? 'Mostrar menos' : 'Leer descripción completa'} onPress={() => setExpanded((v) => !v)}>
                <Text variant="bodySmall" color="textSecondary" numberOfLines={expanded ? undefined : 2}>{s.description}</Text>
                {!expanded && s.description.length > 110 ? <Text variant="label" color="brand" style={{ marginTop: 2 }}>Leer más</Text> : null}
              </ScalePressable>
            ) : null}

            <View style={{ borderRadius: t.radii.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
              {s.shipping_info ? <ListRow icon="truck" title="Envíos" subtitle={s.shipping_info} /> : null}
              {s.shipping_info && policies.length ? <Divider inset={52} /> : null}
              {policies.length ? <ListRow testID="store-policies" icon="shield-check" title="Políticas de la tienda" subtitle={policies.map(([k]) => POLICY_LABEL[k] ?? k).join(', ')} onPress={() => setInfo(true)} /> : null}
            </View>

            {s.reviews.length ? (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Text variant="title">Lo que dicen sus compradores</Text>
                {s.reviews.map((r, i) => (
                  <View key={r.id} style={{ gap: 14 }}>
                    {i > 0 ? <Divider /> : null}
                    <ReviewItem review={r} showProduct />
                  </View>
                ))}
              </View>
            ) : null}

            {s.is_demo ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="info" size={15} color={t.colors.textMuted} />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>Tienda de demostración: sus datos y productos son de prueba.</Text>
              </View>
            ) : null}
            <Text variant="title" style={{ marginTop: 10 }}>Productos</Text>
          </>
        ) : (
          <View style={{ gap: 10 }}>
            <Skeleton width="55%" height={28} />
            <Skeleton width="80%" />
            <Skeleton height={112} radius={t.radii.lg} />
          </View>
        )}
      </View>

      <Sheet visible={info} title="Políticas de la tienda" onClose={() => setInfo(false)} footer={<Button title="Entendido" variant="secondary" full onPress={() => setInfo(false)} />}>
        <View style={{ gap: 16 }}>
          {policies.map(([k, v]) => (
            <View key={k} style={{ gap: 4 }}>
              <Text variant="label">{POLICY_LABEL[k] ?? k}</Text>
              <Text color="textSecondary">{String(v)}</Text>
            </View>
          ))}
          <Text variant="caption" color="textMuted">Si un pedido no llega como esperabas, abre un reclamo desde el pedido. Si la tienda no lo resuelve, puedes escalarlo a {s?.kind === 'platform' ? 'nuestro equipo' : 'la plataforma'}.</Text>
        </View>
      </Sheet>
    </View>
  );
}
