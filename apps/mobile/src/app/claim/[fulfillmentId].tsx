import type { ClaimMessage, ClaimWithContext } from '@kora/api';
import { CLAIM_REASON_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RadioRow } from '@/components/checkout/Rows';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Card, Divider } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { brand } from '@/lib/brand';
import { ACTIVE_CLAIM as ACTIVE, CLAIM_STATUS as STATUS } from '@/lib/claims';
import { shortDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

const MAX = 2000;

/** One delivery's claim: the conversation with the store when one exists, otherwise the form to open it. */
export default function ClaimScreen() {
  const { fulfillmentId } = useLocalSearchParams<{ fulfillmentId: string }>();
  const t = useTheme();
  const q = useQuery({ queryKey: ['claims', 'fulfillment', fulfillmentId], queryFn: () => api.claims.forFulfillment(fulfillmentId) });
  const [startNew, setStartNew] = useState(false);
  const current = q.data?.[0];
  const showForm = q.isSuccess && (!current || (startNew && !ACTIVE.includes(current.status)));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen options={{ title: showForm || !current ? 'Reportar un problema' : `Reclamo ${current.number}` }} />
      {q.isError && !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : waitingForNetwork(q) ? (
        <OfflineState />
      ) : q.isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton height={120} radius={t.radii.lg} />
          <Skeleton height={64} radius={t.radii.lg} width="70%" />
        </View>
      ) : showForm ? (
        <NewClaim fulfillmentId={fulfillmentId} onCreated={() => setStartNew(false)} />
      ) : current ? (
        <ClaimThread claim={current} onStartNew={() => setStartNew(true)} />
      ) : null}
    </View>
  );
}

function NewClaim({ fulfillmentId, onCreated }: { fulfillmentId: string; onCreated: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<string>('not_received');
  const [description, setDescription] = useState('');
  const open = useMutation({
    mutationFn: () => api.claims.open(fulfillmentId, reason as never, description.trim()),
    onSuccess: async () => {
      haptics.success();
      await qc.invalidateQueries({ queryKey: ['claims'] });
      onCreated();
    },
    onError: () => haptics.warning(),
  });
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView testID="claim-form" contentContainerStyle={{ padding: 20, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text color="textSecondary">Cuéntanos qué pasó con esta entrega. La tienda verá tu mensaje y te responderá en esta misma conversación.</Text>
        <Card padded={false}>
          {Object.entries(CLAIM_REASON_LABEL).map(([k, label], i) => (
            <View key={k}>
              {i > 0 ? <Divider inset={16} /> : null}
              <RadioRow testID={`claim-reason-${k}`} selected={reason === k} title={label} onPress={() => setReason(k)} />
            </View>
          ))}
        </Card>
        <TextField
          testID="claim-description"
          label="Describe el problema"
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, MAX))}
          multiline
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          helper="Mínimo 10 caracteres. Incluye lo que esperabas recibir y lo que llegó."
        />
        {open.error ? <Banner tone="danger" icon="circle-alert" body={(open.error as Error).message} /> : null}
        <Button testID="claim-submit" title="Enviar reclamo" size="lg" full disabled={description.trim().length < 10} loading={open.isPending} onPress={() => open.mutate()} />
        <Text variant="caption" color="textMuted" align="center">
          La tienda tiene un plazo para responder. Si no lo hace o no llegan a un acuerdo, puedes pedir que {brand.name} intervenga.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ClaimThread({ claim: c, onStartNew }: { claim: ClaimWithContext; onStartNew: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState(false);
  // time of opening the thread; a refetch re-renders with fresh data, which is precise enough for a 48 h window
  const [now] = useState(() => Date.now());
  const closed = !ACTIVE.includes(c.status);
  const messages = useQuery({
    queryKey: ['claims', 'messages', c.id],
    queryFn: () => api.claims.messages(c.id),
    refetchInterval: closed ? false : 30_000,
  });
  const hours = useQuery({ queryKey: ['claims', 'response-hours'], queryFn: api.claims.responseHours, staleTime: 60 * 60_000 });
  const deadline = new Date(new Date(c.created_at).getTime() + (hours.data ?? 48) * 3600_000);
  const windowOver = now > deadline.getTime();
  const canEscalate = hours.isSuccess && (c.status === 'seller_responded' || (c.status === 'open' && windowOver));
  const refresh = () => qc.invalidateQueries({ queryKey: ['claims'] });

  const send = useMutation({
    mutationFn: () => api.claims.post(c.id, draft.trim()),
    onSuccess: async () => {
      setDraft('');
      haptics.tap();
      await refresh();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    },
    onError: () => haptics.warning(),
  });
  const escalate = useMutation({
    mutationFn: () => api.claims.escalate(c.id),
    onSuccess: async () => {
      setConfirm(false);
      haptics.success();
      await refresh();
    },
    onError: () => haptics.warning(),
  });

  const status = STATUS[c.status] ?? { label: c.status, tone: 'muted' as Tone };
  const store = c.stores?.name ?? 'La tienda';
  const explainer =
    c.status === 'open'
      ? windowOver
        ? `${store} no respondió dentro del plazo. Puedes pedir que ${brand.name} intervenga.`
        : `${store} tiene hasta el ${shortDateTime(deadline.toISOString())} para responder. Si no lo hace, podrás pedir que ${brand.name} intervenga.`
      : c.status === 'seller_responded'
        ? `Si la respuesta no resuelve el problema, puedes pedir que ${brand.name} intervenga.`
        : c.status === 'escalated'
          ? 'Nuestro equipo revisa la conversación y la evidencia. Te avisaremos la decisión aquí y en tus notificaciones.'
          : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        testID="claim-thread"
        contentContainerStyle={{ padding: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ padding: 16, gap: 10, borderRadius: t.radii.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text variant="subtitle" style={{ flex: 1 }}>{CLAIM_REASON_LABEL[c.reason] ?? c.reason}</Text>
            <Badge testID="claim-status" label={status.label} tone={status.tone} />
          </View>
          <Text variant="caption" color="textMuted">
            {c.orders?.number ? `Pedido ${c.orders.number} · ` : ''}{store} · abierto el {shortDateTime(c.created_at)}
          </Text>
          {explainer ? <Text variant="bodySmall" color="textSecondary">{explainer}</Text> : null}
          {closed && c.resolution ? (
            <Banner tone={c.status === 'resolved' ? 'success' : 'info'} icon={c.status === 'resolved' ? 'circle-check' : 'info'} title="Decisión" body={c.resolution} />
          ) : null}
          {canEscalate ? (
            <Button testID="claim-escalate" title={`Pedir que ${brand.name} intervenga`} variant="secondary" icon="shield-check" onPress={() => setConfirm(true)} />
          ) : null}
        </View>

        {messages.isLoading ? <Skeleton height={80} radius={t.radii.lg} /> : null}
        {(messages.data ?? []).map((m) => <Bubble key={m.id} message={m} store={store} />)}
        {closed ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Text variant="caption" color="textMuted" align="center">Este reclamo está cerrado. Si aparece otro problema con esta entrega, puedes abrir uno nuevo.</Text>
            <Button title="Abrir otro reclamo" variant="ghost" size="sm" onPress={onStartNew} />
          </View>
        ) : null}
      </ScrollView>

      {!closed ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: t.colors.chrome, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.borderStrong }}>
          {send.error ? <Text variant="caption" color="danger" style={{ marginBottom: 6, marginLeft: 6 }}>{(send.error as Error).message}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
            <TextInput
              testID="claim-message"
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, MAX))}
              placeholder={`Escribe a ${store}…`}
              placeholderTextColor={t.colors.textMuted}
              multiline
              accessibilityLabel="Mensaje"
              style={{ flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, color: t.colors.text, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 }}
            />
            <IconButton
              testID="claim-send"
              icon="arrow-up"
              label="Enviar mensaje"
              tone="brand"
              size={44}
              onPress={() => draft.trim() && !send.isPending && send.mutate()}
            />
          </View>
        </View>
      ) : null}

      <Sheet
        visible={confirm}
        title={`¿Pedir que ${brand.name} intervenga?`}
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button testID="claim-escalate-confirm" title="Pedir intervención" full loading={escalate.isPending} onPress={() => escalate.mutate()} />
            <Button title="Ahora no" variant="ghost" full onPress={() => setConfirm(false)} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text color="textSecondary">Nuestro equipo leerá la conversación con {store}, revisará la evidencia y tomará una decisión. Puedes seguir escribiendo mientras tanto.</Text>
          {escalate.error ? <Banner tone="danger" icon="circle-alert" body={(escalate.error as Error).message} /> : null}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message: m, store }: { message: ClaimMessage; store: string }) {
  const t = useTheme();
  const mine = m.author_role === 'buyer';
  const who = mine ? 'Tú' : m.author_role === 'admin' ? `Equipo de ${brand.name}` : store;
  const bg = mine ? t.colors.brandSoft : m.author_role === 'admin' ? t.colors.accentSoft : t.colors.surface;
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 4 }} testID={`claim-msg-${m.id}`}>
      <Text variant="caption" color="textMuted" style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginHorizontal: 4 }}>
        {who} · {shortDateTime(m.created_at)}
      </Text>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          backgroundColor: bg,
          borderWidth: mine ? 0 : 1,
          borderColor: t.colors.border,
        }}
      >
        <Text>{m.body}</Text>
      </View>
    </View>
  );
}
