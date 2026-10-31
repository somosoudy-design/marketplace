import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import type { Notification } from '@kora/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View, type ViewToken } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { timeAgo } from '@/lib/format';
import { useNotifications } from '@/lib/hooks';
import { noticeTarget } from '@/lib/notice-target';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme, type Theme } from '@/theme';

const NOTICE_VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 1500 };

type Kind = 'good' | 'attention' | 'problem' | 'shipping' | 'neutral';
const KIND: Record<string, { icon: IconName; kind: Kind }> = {
  order_placed: { icon: 'receipt', kind: 'neutral' },
  payment_received: { icon: 'hourglass', kind: 'neutral' },
  payment_confirmed: { icon: 'circle-check', kind: 'good' },
  payment_rejected: { icon: 'circle-alert', kind: 'problem' },
  fulfillment_update: { icon: 'truck', kind: 'shipping' },
  order_dispatched: { icon: 'truck', kind: 'shipping' },
  order_delivered: { icon: 'package', kind: 'good' },
  installment_due: { icon: 'calendar', kind: 'attention' },
  claim_update: { icon: 'message-circle', kind: 'attention' },
  back_in_stock: { icon: 'bell', kind: 'good' },
  seller_new_order: { icon: 'store', kind: 'neutral' },
  product_moderation: { icon: 'shield-check', kind: 'neutral' },
  system: { icon: 'info', kind: 'neutral' },
};

function swatch(t: Theme, k: Kind): [string, string] {
  switch (k) {
    case 'good': return [t.colors.successSoft, t.colors.success];
    case 'attention': return [t.colors.warningSoft, t.colors.warning];
    case 'problem': return [t.colors.dangerSoft, t.colors.danger];
    case 'shipping': return [t.colors.infoSoft, t.colors.info];
    default: return [t.colors.brandSoft, t.colors.brand];
  }
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400_000;
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return 'Esta semana';
  return 'Anteriores';
}

export default function NotificationsScreen() {
  const { ready, user } = useAuth();
  if (!ready) return <Skeleton height={68} />;
  if (!user) return <EmptyState icon="bell" title="Inicia sesión para ver tus avisos" action="Iniciar sesión" onAction={() => router.push('/sign-in')} />;
  return <NotificationInbox key={user.id} />;
}

function NotificationInbox() {
  const t = useTheme();
  const qc = useQueryClient();
  const q = useNotifications();
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const markAll = useMutation({
    mutationFn: (ids: string[]) => api.account.markNotificationsRead(ids),
    onSuccess: async (_count, ids) => {
      setFresh((previous) => new Set([...previous, ...ids]));
      await qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
  // SectionList invokes this stable callback only after a row stays at least 60% visible for 1.5 seconds.
  // Loaded pages are NOT assumed read. Off-screen notices remain unread until viewed or explicitly marked.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<Notification>[] }) => {
    setVisibleIds(viewableItems.filter((item) => item.isViewable && typeof item.item?.id === 'string').map((item) => item.item.id));
  }, []);
  const visible = new Set(visibleIds);
  const unreadLoaded = (q.data ?? []).filter((n) => !n.read_at).map((n) => n.id);
  const unreadVisible = unreadLoaded.filter((id) => visible.has(id)).join(',');
  const { mutate: markViewed, isPending: marking, isError: markFailed } = markAll;
  useEffect(() => {
    if (!unreadVisible || marking || markFailed) return;
    markViewed(unreadVisible.split(','));
  }, [unreadVisible, marking, markFailed, markViewed]);

  const sections = useMemo(() => {
    const out: { title: string; data: Notification[] }[] = [];
    for (const n of q.data ?? []) {
      const title = dayBucket(n.created_at);
      const last = out[out.length - 1];
      if (last?.title === title) last.data.push(n);
      else out.push({ title, data: [n] });
    }
    return out;
  }, [q.data]);

  // when every notice comes from demo data one banner says so, instead of a label on each row
  const allTest = !!q.data?.length && q.data.every((n) => n.is_test);

  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (waitingForNetwork(q)) return <OfflineState />;
  return (
    <SectionList
      testID="notifications-list"
      sections={sections}
      keyExtractor={(n) => n.id}
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center', flexGrow: 1 }}
      stickySectionHeadersEnabled={false}
      viewabilityConfig={NOTICE_VIEWABILITY}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={t.colors.brand} />}
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ gap: 10, paddingTop: 16 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} radius={t.radii.lg} />)}</View>
        ) : (
          <EmptyState icon="bell" title="Todo al día" body="Aquí verás los avisos de tus pagos, envíos y reclamos." />
        )
      }
      ListHeaderComponent={<View style={{ gap: 12, marginTop: 16 }}>
        {unreadLoaded.length ? <Button testID="notifications-mark-loaded" title="Marcar cargadas como leídas" variant="ghost" loading={marking} onPress={() => markViewed(unreadLoaded)} /> : null}
        {allTest && !isPrivateCatalogPresentation ? <Banner tone="info" icon="info" body="Estos avisos vienen de pedidos de demostración. Son de prueba y nunca se envían como notificación a tu teléfono." /> : null}
        {q.isError && q.data ? <Banner tone="warning" body="No pudimos actualizar tus avisos."><Button title="Reintentar" variant="ghost" onPress={() => q.isFetchNextPageError ? q.fetchNextPage() : q.refetch()} /></Banner> : null}
        {markAll.isError ? <Banner tone="warning" body="No pudimos marcar estos avisos como leídos."><Button title="Reintentar" variant="ghost" loading={markAll.isPending} onPress={() => markAll.variables && markViewed(markAll.variables)} /></Banner> : null}
      </View>}
      ListFooterComponent={q.hasNextPage ? <Button testID="notifications-more" title="Ver más notificaciones" variant="secondary" loading={q.isFetchingNextPage} disabled={q.isFetching} onPress={() => q.fetchNextPage()} style={{ marginTop: 20 }} /> : null}
      renderSectionHeader={({ section }) => (
        <Text variant="overline" color="textMuted" style={{ marginTop: 22, marginBottom: 8, marginLeft: 4 }}>{section.title}</Text>
      )}
      renderItem={({ item: n, index, section }) => (
        <Row n={n} isNew={!n.read_at || fresh.has(n.id)} first={index === 0} last={index === section.data.length - 1} labelTest={!allTest && !isPrivateCatalogPresentation} />
      )}
    />
  );
}

function Row({ n, isNew, first, last, labelTest }: { n: Notification; isNew: boolean; first: boolean; last: boolean; labelTest: boolean }) {
  const t = useTheme();
  const meta = KIND[n.kind] ?? { icon: 'bell' as IconName, kind: 'neutral' as Kind };
  const [bg, fg] = swatch(t, meta.kind);
  const to = noticeTarget(n.kind, n.data as Record<string, unknown> | null);
  const store = ((n.data ?? {}) as Record<string, string>).audience === 'store';
  return (
    <ScalePressable
      testID={`notification-${n.id}`}
      scaleTo={to ? 0.99 : 1}
      disabled={!to}
      accessibilityRole={to ? 'link' : undefined}
      accessibilityLabel={`${isNew ? 'Nueva. ' : ''}${n.title}. ${n.body}`}
      onPress={() => to && router.push(to)}
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: t.colors.surface,
        borderTopLeftRadius: first ? t.radii.lg : 0,
        borderTopRightRadius: first ? t.radii.lg : 0,
        borderBottomLeftRadius: last ? t.radii.lg : 0,
        borderBottomRightRadius: last ? t.radii.lg : 0,
        borderWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={19} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="label" numberOfLines={2} style={{ flex: 1, fontFamily: isNew ? 'PlusJakartaSans_700Bold' : undefined }}>{n.title}</Text>
          <Text variant="caption" color="textMuted">{timeAgo(n.created_at)}</Text>
          {isNew ? <View accessibilityElementsHidden style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.brand }} /> : null}
        </View>
        <Text variant="bodySmall" color="textSecondary" numberOfLines={3}>{n.body}</Text>
        {(labelTest && n.is_test) || store ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {labelTest && n.is_test ? <Badge label="Prueba · datos de demostración" tone="muted" /> : null}
            {store ? <Badge label="Para tu tienda · gestiónalo en el panel" tone="brand" /> : null}
          </View>
        ) : null}
      </View>
      {to ? <View style={{ alignSelf: 'center' }}><Icon name="chevron-right" size={16} color={t.colors.textMuted} /></View> : null}
      {!last ? <View style={{ position: 'absolute', left: 66, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} /> : null}
    </ScalePressable>
  );
}
