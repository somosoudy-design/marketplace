import { storeAccents } from '@kora/design-tokens';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Catalog } from '@/components/catalog/Catalog';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useStore } from '@/lib/hooks';
import { api, storeImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore(slug);
  const s = store.data;
  useEffect(() => {
    if (s?.id) void api.catalog.track('store_view', { storeId: s.id });
  }, [s?.id]);

  const accent = s ? storeAccents[s.accent as keyof typeof storeAccents] ?? t.colors.brand : t.colors.surfaceSunken;
  const policies = (s?.policies ?? {}) as Record<string, string>;
  const header = (
    <View style={{ marginBottom: 6 }}>
      <View style={{ aspectRatio: 16 / 7, backgroundColor: accent }}>
        {s?.cover_path ? <Image source={{ uri: storeImage(s.cover_path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: -34, gap: 10 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: t.colors.surface, padding: 4, ...t.elevation.low }}>
          {s?.logo_path ? <Image source={{ uri: storeImage(s.logo_path) ?? undefined }} style={{ flex: 1, borderRadius: 18 }} /> : <View style={{ flex: 1, borderRadius: 18, backgroundColor: accent }} />}
        </View>
        {s ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text variant="displayM" style={{ flexShrink: 1 }}>{s.name}</Text>
              {s.kind === 'platform' ? <Badge label="Tienda oficial" tone="brand" /> : <Badge label="Vendedor verificado" tone="info" />}
            </View>
            {s.tagline ? <Text color="textSecondary">{s.tagline}</Text> : null}
            {s.description ? <Text variant="bodySmall" color="textSecondary">{s.description}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              {s.rating_count > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={15} color={t.colors.accent} fill={t.colors.accent} />
                  <Text variant="label">{Number(s.rating_avg).toFixed(1)}</Text>
                  <Text variant="caption" color="textMuted">({s.rating_count} opiniones)</Text>
                </View>
              ) : (
                <Text variant="caption" color="textMuted">Aún sin opiniones</Text>
              )}
              {s.shipping_info ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
                  <Icon name="truck" size={15} color={t.colors.textMuted} />
                  <Text variant="caption" color="textMuted" style={{ flexShrink: 1 }}>{s.shipping_info}</Text>
                </View>
              ) : null}
            </View>
            {Object.keys(policies).length ? (
              <View style={{ gap: 4 }}>
                {Object.entries(policies).map(([k, v]) => (
                  <Text key={k} variant="caption" color="textSecondary">
                    <Text variant="caption" style={{ fontFamily: 'Manrope_700Bold' }}>{POLICY_LABEL[k] ?? k}: </Text>
                    {String(v)}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ gap: 8 }}><Skeleton width="60%" height={24} /><Skeleton width="80%" /></View>
        )}
      </View>
    </View>
  );

  if (store.isSuccess && !s) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60, backgroundColor: t.colors.background }}>
        <IconButton icon="chevron-left" label="Volver" tone="glass" onPress={() => router.back()} style={{ position: 'absolute', left: 16, top: insets.top + 8 }} />
        <EmptyState icon="store" title="Esta tienda no está disponible" body="Puede estar en revisión o suspendida temporalmente." />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Catalog key={slug} testID="store-catalog" initial={{ store: slug }} locked={['store']} header={header} showSearch />
      <IconButton testID="store-back" icon="chevron-left" label="Volver" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ position: 'absolute', left: 16, top: insets.top + 8 }} />
    </View>
  );
}

const POLICY_LABEL: Record<string, string> = { returns: 'Devoluciones', warranty: 'Garantía', shipping: 'Envíos', invoices: 'Facturación', response_time: 'Respuesta' };
