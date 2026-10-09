import { ApiError, type Payment, type PaymentMethod, type PaymentQuote } from '@kora/api';
import { D, formatMoney, formatRate, formatUSD, normalizeReference, OBLIGATION_KIND_LABEL, type Currency } from '@kora/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SummaryRow } from '@/components/checkout/Rows';
import { BottomBar } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card, Divider } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, ErrorState, OfflineState, StaleNotice, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { SOURCE_LABEL, shortDate, shortDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useOrder, usePaymentMethods } from '@/lib/hooks';
import { intentKey } from '@/lib/ids';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const MAX_W = 720;
const FIELD_LABEL: Record<string, string> = {
  banco: 'Banco', titular: 'Titular', telefono: 'Teléfono', documento: 'RIF / Cédula', cuenta: 'Cuenta', correo: 'Correo', red: 'Red', direccion: 'Dirección',
};

export default function PayScreen() {
  const { orderId, fresh } = useLocalSearchParams<{ orderId: string; fresh?: string }>();
  const t = useTheme();
  const order = useOrder(orderId);
  const methods = usePaymentMethods();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [submitted, setSubmitted] = useState<{ number: string; online?: string } | null>(null);
  const qc = useQueryClient();

  const createQuote = useMutation({
    mutationFn: (code: string) => api.payments.quote(orderId, code),
    onSuccess: (q) => setQuote(q),
    onError: () => haptics.warning(),
  });

  const cancelOnline = useMutation({
    mutationFn: (paymentId: string) => api.payments.cancelOnline(paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.order(orderId) }),
    onError: () => haptics.warning(),
  });

  const o = order.data;
  const pending = (o?.payments ?? []).filter((p) => p.status === 'pending_verification' || p.status === 'processing');
  const outstanding = o ? D(o.total_usd).minus(o.refunded_usd ?? 0).minus(o.paid_usd) : D(0);
  const nextObligation = (o?.payment_obligations ?? []).find((x) => x.status === 'pending' || x.status === 'partially_paid');

  const picking = !!nextObligation && !pending.length && !quote;

  if (order.isError && !order.data) return <ErrorState error={order.error} onRetry={() => order.refetch()} />;
  if (waitingForNetwork(order)) return <OfflineState />;
  if (!o) return <View style={{ padding: 16, gap: 12, flex: 1, backgroundColor: t.colors.background }}>{[120, 260].map((h, i) => <Skeleton key={i} height={h} radius={t.radii.lg} />)}</View>;

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 24, justifyContent: 'center', gap: 16, alignItems: 'center' }}>
        <Stack.Screen options={{ title: 'Pago enviado', headerBackVisible: false }} />
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="hourglass" size={38} color={t.colors.brand} />
        </View>
        <Text variant="displayM" align="center" testID="payment-submitted">{submitted.online ? `Pago ${submitted.number} iniciado` : `Recibimos tu pago ${submitted.number}`}</Text>
        <Text color="textSecondary" align="center">
          {submitted.online
            ? `Lo confirmamos en cuanto ${submitted.online} nos avise que el pago fue exitoso, y te avisaremos por notificación. Si lo cancelaste, vuelve al pedido y elige otro método.`
            : 'Lo estamos verificando con el banco. Tu pedido avanza cuando lo confirmemos y te avisaremos por notificación.'}
        </Text>
        <Button title="Ver mi pedido" full onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })} style={{ maxWidth: 420, width: '100%' }} />
        <Button title="Seguir comprando" variant="ghost" onPress={() => router.dismissTo('/')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen options={{ title: `Pagar ${o.number}`, headerBackVisible: !fresh }} />
      <ScrollView testID="pay-scroll" contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: picking ? 150 : 60, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <StaleNotice q={order} />
        {fresh ? <Banner tone="success" icon="circle-check" title={`Pedido ${o.number} creado`} body="Apartamos tus productos. Completa el pago para que lo preparemos." /> : null}

        <Card style={{ gap: 10 }}>
          <SummaryRow label="Total del pedido" value={formatUSD(o.total_usd)} />
          <SummaryRow label="Pagado y confirmado" value={formatUSD(o.paid_usd)} />
          <Divider />
          <SummaryRow label="Saldo pendiente" value={formatUSD(outstanding)} strong testID="pay-outstanding" />
          {nextObligation && !pending.length ? (
            <Text variant="caption" color="textMuted">
              Ahora pagas: {OBLIGATION_KIND_LABEL[nextObligation.kind] ?? 'pago'}{nextObligation.kind === 'installment' ? ` ${nextObligation.seq}` : ''} por {formatUSD(D(nextObligation.amount_usd).minus(nextObligation.paid_usd).minus(nextObligation.waived_usd))}
              {nextObligation.due_date ? ` · vence ${shortDate(nextObligation.due_date)}` : ''}
            </Text>
          ) : null}
        </Card>

        {/* while a payment is being checked the order can't be paid again, so the screen shows that payment instead of a picker */}
        {pending.filter((p) => p.status === 'pending_verification').map((p) => (
          <PendingCard key={p.id} payment={p} methodName={methods.data?.find((m) => m.code === p.method_code)?.name ?? p.method_code} onOrder={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })} />
        ))}
        {pending.filter((p) => p.status === 'processing' && p.provider).map((p) => (
          <Card key={p.id} style={{ gap: 10 }}>
            <Text variant="subtitle">Pago en línea {p.number} sin completar</Text>
            <Text variant="bodySmall" color="textSecondary">Si no terminaste de pagar, retómalo o cancélalo para elegir otro método. Si ya pagaste, espera la confirmación: no lo canceles.</Text>
            {cancelOnline.error ? <Banner tone="danger" icon="circle-alert" body={(cancelOnline.error as Error).message} /> : null}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {p.provider_checkout_url ? (
                <Button title="Retomar pago" icon="wallet" onPress={() => (Platform.OS === 'web' ? window.open(p.provider_checkout_url!, '_blank', 'noopener') : WebBrowser.openAuthSessionAsync(p.provider_checkout_url!, `${brand.scheme}://pay/result`))} />
              ) : null}
              <Button testID={`cancel-online-${p.number}`} title="Cancelar intento" variant="secondary" loading={cancelOnline.isPending} onPress={() => cancelOnline.mutate(p.id)} />
            </View>
          </Card>
        ))}

        {!nextObligation ? (
          <Banner tone="success" icon="circle-check" title="Este pedido no tiene saldo pendiente" />
        ) : pending.length ? null : !quote ? (
          <MethodPicker
            methods={methods.data ?? []}
            selected={method?.code ?? null}
            amountUsd={D(nextObligation.amount_usd).minus(nextObligation.paid_usd).minus(nextObligation.waived_usd)}
            onSelect={setMethod}
            error={createQuote.error ? (createQuote.error as Error).message : null}
          />
        ) : (
          <QuotePanel
            quote={quote}
            onRequote={() => createQuote.mutate(quote.method_code)}
            requoting={createQuote.isPending}
            onChangeMethod={() => setQuote(null)}
            onSubmitted={(number, online) => {
              haptics.success();
              qc.invalidateQueries({ queryKey: qk.order(orderId) });
              qc.invalidateQueries({ queryKey: qk.orders });
              qc.invalidateQueries({ queryKey: qk.notifications });
              setSubmitted({ number, online });
            }}
          />
        )}
      </ScrollView>
      {picking ? (
        <BottomBar maxWidth={MAX_W}>
          <Button
            testID="pay-quote"
            title={method ? `Continuar con ${method.name}` : 'Elige un método'}
            size="lg"
            full
            disabled={!method}
            loading={createQuote.isPending}
            onPress={() => method && createQuote.mutate(method.code)}
          />
          <Text variant="caption" color="textMuted" align="center">Te mostramos el monto exacto y los datos para pagar.</Text>
        </BottomBar>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const METHOD_GROUPS: { title: string; match: (m: PaymentMethod) => boolean }[] = [
  { title: 'En bolívares', match: (m) => m.currency === 'VES' },
  { title: 'En dólares', match: (m) => m.currency === 'USD' && m.kind !== 'automated' },
  { title: 'Con cripto', match: (m) => m.currency !== 'VES' && m.currency !== 'USD' && m.kind !== 'automated' },
  { title: 'En línea', match: (m) => m.kind === 'automated' },
];
const RAIL_ICON: Record<string, IconName> = {
  pago_movil: 'smartphone', bank_transfer_ve: 'landmark', zelle: 'zap', usdt_trc20: 'coins', binance_pay: 'coins', paypal: 'globe', cash: 'banknote',
};

/** Methods grouped by the currency the buyer pays in, each with what it costs and its limits; the exact amount
 * comes from the server's quote in the next step. */
function MethodPicker({ methods, selected, amountUsd, onSelect, error }: { methods: PaymentMethod[]; selected: string | null; amountUsd: ReturnType<typeof D>; onSelect: (m: PaymentMethod) => void; error: string | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 4 }}>
        <Text variant="title">Elige cómo pagar</Text>
        <Text variant="bodySmall" color="textSecondary">Ahora pagas {formatUSD(amountUsd)}. En bolívares o cripto lo convertimos con la tasa del momento.</Text>
      </View>
      {METHOD_GROUPS.map((g) => {
        const list = methods.filter(g.match);
        if (!list.length) return null;
        return (
          <View key={g.title} style={{ gap: 8 }}>
            <Text variant="overline" color="textMuted">{g.title.toUpperCase()}</Text>
            <Card padded={false}>
              {list.map((m, i) => {
                const min = Number(m.min_usd);
                const max = m.max_usd == null ? null : Number(m.max_usd);
                const limit = min > 0 && amountUsd.lt(min) ? `Desde ${formatUSD(min)}` : max != null && amountUsd.gt(max) ? `Hasta ${formatUSD(max)}` : null;
                const fee = Number(m.fee_pct) > 0 ? `+${String(Number(m.fee_pct)).replace('.', ',')} %` : Number(m.fee_fixed_usd) > 0 ? `+${formatUSD(m.fee_fixed_usd)}` : null;
                const on = selected === m.code;
                return (
                  <View key={m.code}>
                    {i > 0 ? <Divider inset={68} /> : null}
                    <Pressable
                      testID={`method-${m.code}`}
                      accessibilityRole="radio"
                      aria-checked={on}
                      aria-disabled={!!limit}
                      disabled={!!limit}
                      onPress={() => { haptics.select(); onSelect(m); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: limit ? 0.5 : 1, backgroundColor: on ? t.colors.brandSoft : pressed ? t.colors.surfaceSunken : 'transparent' })}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: t.radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.colors.brand : t.colors.surfaceSunken }}>
                        <Icon name={RAIL_ICON[m.rail] ?? 'wallet'} size={20} color={on ? t.colors.onBrand : t.colors.text} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="subtitle" style={{ fontSize: 15 }}>{m.name}</Text>
                        {m.description ? <Text variant="caption" color="textMuted" numberOfLines={2}>{m.description}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text variant="label" tabular>{m.currency === 'VES' ? 'Bs.' : m.currency}</Text>
                        <Text variant="caption" color={limit ? 'warning' : 'textMuted'}>{limit ?? fee ?? 'Sin comisión'}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}
      {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
    </View>
  );
}

function PendingCard({ payment: p, methodName, onOrder }: { payment: Payment; methodName: string; onOrder: () => void }) {
  const t = useTheme();
  const currency = p.currency as Currency;
  return (
    <Card testID={`pending-${p.number}`} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="hourglass" size={20} color={t.colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle">Estamos verificando tu pago</Text>
          <Text variant="caption" color="textMuted">{p.number} · enviado {shortDateTime(p.created_at)}</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <SummaryRow label="Método" value={methodName} />
        <SummaryRow label="Monto" value={formatMoney(p.amount, currency)} />
        {currency !== 'USD' ? <SummaryRow label="Equivale a" value={formatUSD(p.base_usd)} /> : null}
        {p.reference ? <SummaryRow label="Referencia" value={p.reference} /> : null}
      </View>
      <Text variant="bodySmall" color="textSecondary">
        Revisamos que el dinero haya llegado a la cuenta indicada. Cuando lo confirmemos, tu saldo se actualiza y te avisamos. No hace falta pagar de nuevo.
      </Text>
      <Button title="Ver mi pedido" variant="secondary" onPress={onOrder} />
    </Card>
  );
}

function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(expiresAt).getTime() - now;
  return { expired: ms <= 0, label: ms <= 0 ? '0:00' : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`, ms };
}

function QuotePanel({ quote: q, onRequote, requoting, onChangeMethod, onSubmitted }: { quote: PaymentQuote; onRequote: () => void; requoting: boolean; onChangeMethod: () => void; onSubmitted: (number: string, online?: string) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const countdown = useCountdown(q.expires_at);
  const [reference, setReference] = useState('');
  const [payerBank, setPayerBank] = useState('');
  const [proof, setProof] = useState<{ uri: string; path?: string; uploading?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // one idempotency key per quote: a double tap or a retry after a timeout cannot create two payments
  const payKey = useRef(intentKey('pay'));
  useEffect(() => {
    payKey.current = intentKey('pay');
  }, [q.id]);
  const currency = q.currency as Currency;
  const instructions = Object.entries((q.method.instructions ?? {}) as Record<string, string>).filter(([k]) => k !== 'nota');
  const note = (q.method.instructions as Record<string, string> | null)?.nota;
  const isVes = q.currency === 'VES';

  const submit = useMutation({
    mutationFn: async () => {
      if (q.method.requires_reference && normalizeReference(reference).length < 4) throw new Error('Escribe la referencia del pago.');
      if (q.method.requires_proof && !proof?.path) throw new Error('Adjunta el comprobante del pago.');
      return api.payments.submit({ quoteId: q.id, reference: reference.trim() || null, proofPath: proof?.path ?? null, payer: payerBank ? { bank: payerBank } : {}, idempotencyKey: payKey.current });
    },
    onSuccess: (r) => {
      if (r.error === 'quote_expired') return setError('El monto expiró porque la tasa pudo cambiar. Actualízalo para continuar.');
      if (r.error === 'obligation_already_paid') return setError('Esa cuota ya fue pagada. Vuelve al pedido.');
      if (!r.error) onSubmitted(r.number);
    },
    onError: (e) => setError(e instanceof ApiError || e instanceof Error ? e.message : 'No pudimos enviar el pago.'),
  });

  const pickProof = async () => {
    setError(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
    if (r.canceled || !r.assets[0] || !user) return;
    const asset = r.assets[0];
    if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) return setError('La imagen supera 5 MB. Elige una más liviana.');
    setProof({ uri: asset.uri, uploading: true });
    try {
      const body = await (await fetch(asset.uri)).arrayBuffer();
      const type = asset.mimeType ?? 'image/jpeg';
      const path = await api.payments.uploadProof(user.id, body, type, type.split('/')[1] ?? 'jpg');
      setProof({ uri: asset.uri, path });
    } catch (e) {
      setProof(null);
      setError((e as Error).message);
    }
  };

  const amount = useMemo(() => formatMoney(q.amount_due, currency), [q.amount_due, currency]);

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 12, borderColor: countdown.expired ? t.colors.danger : t.colors.brand, borderWidth: 1.5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="label" color="textSecondary">{q.method.name}</Text>
          <Pressable onPress={onChangeMethod} hitSlop={8} accessibilityRole="button"><Text variant="label" color="brand">Cambiar método</Text></Pressable>
        </View>
        <Text variant="overline" color="textMuted">MONTO EXACTO A PAGAR</Text>
        <Pressable accessibilityRole="button" accessibilityHint="Copia el monto" onPress={() => { Clipboard.setStringAsync(D(q.amount_due).toFixed(2)); haptics.tap(); }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text variant="displayXL" tabular testID="quote-amount" style={{ color: countdown.expired ? t.colors.textMuted : t.colors.text }}>{amount}</Text>
            <Icon name="copy" size={18} color={t.colors.textMuted} />
          </View>
        </Pressable>
        {isVes ? (
          <Text variant="bodySmall" color="textSecondary" testID="quote-rate">
            {formatUSD(D(q.base_usd).plus(q.fee_usd))} × {formatRate(q.rate_applied)} · {SOURCE_LABEL[q.rate_source] ?? q.rate_source}, {shortDateTime(q.rate_observed_at)}
          </Text>
        ) : Number(q.fee_usd) > 0 ? (
          <Text variant="bodySmall" color="textSecondary">Incluye comisión del método de {formatUSD(q.fee_usd)}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={16} color={countdown.expired ? t.colors.danger : t.colors.textMuted} />
          <Text variant="caption" color={countdown.expired ? 'danger' : 'textMuted'} testID="quote-expiry">
            {countdown.expired ? 'Este monto expiró. Actualízalo antes de pagar.' : `Monto válido por ${countdown.label} min. Después lo recalculamos con la tasa vigente.`}
          </Text>
        </View>
        {countdown.expired ? <Button testID="quote-refresh" title="Actualizar monto" icon="refresh-cw" loading={requoting} onPress={onRequote} /> : null}
      </Card>

      {q.method.kind === 'automated' ? (
        <OnlinePay quote={q} expired={countdown.expired} onStarted={(number) => onSubmitted(number, q.method.name)} />
      ) : null}

      {q.method.kind !== 'automated' && instructions.length ? (
        <Card style={{ gap: 12 }}>
          <Text variant="title">Datos para pagar</Text>
          {note ? <Banner tone="warning" icon="info" body={note} /> : null}
          {instructions.map(([k, v]) => (
            <Pressable key={k} accessibilityRole="button" accessibilityHint="Copia el dato" onPress={() => { Clipboard.setStringAsync(String(v)); haptics.tap(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textMuted">{FIELD_LABEL[k] ?? k}</Text>
                <Text variant="subtitle" selectable>{String(v)}</Text>
              </View>
              <Icon name="copy" size={18} color={t.colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {q.method.kind !== 'automated' ? (
        <Card style={{ gap: 14 }}>
          <Text variant="title">Confirma tu pago</Text>
          {q.method.requires_reference ? (
            <TextField
              testID="pay-reference"
              label={q.method.code === 'usdt_trc20' ? 'Hash de la transacción' : 'Número de referencia'}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType={q.method.code === 'usdt_trc20' ? 'default' : 'number-pad'}
              helper={q.method.code === 'usdt_trc20' ? 'Lo encuentras en el detalle del retiro.' : 'Los últimos dígitos que aparecen en tu comprobante.'}
            />
          ) : null}
          {isVes ? <TextField label="Banco desde el que pagaste (opcional)" value={payerBank} onChangeText={setPayerBank} /> : null}
          <View style={{ gap: 8 }}>
            <Text variant="label" color="textSecondary">Comprobante {q.method.requires_proof ? '' : '(opcional)'}</Text>
            {proof ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={{ uri: proof.uri }} style={{ width: 56, height: 72, borderRadius: 8 }} contentFit="cover" />
                <Text variant="bodySmall" color={proof.path ? 'success' : 'textMuted'} style={{ flex: 1 }}>{proof.uploading ? 'Subiendo…' : 'Comprobante adjunto'}</Text>
                <Pressable onPress={pickProof} hitSlop={8}><Text variant="label" color="brand">Cambiar</Text></Pressable>
              </View>
            ) : (
              <Button testID="pay-proof" title="Adjuntar captura" variant="secondary" icon="image" onPress={pickProof} />
            )}
          </View>
          {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
          <Button
            testID="pay-submit"
            title="Ya pagué, enviar para verificar"
            size="lg"
            full
            loading={submit.isPending}
            disabled={countdown.expired || !!proof?.uploading}
            onPress={() => { setError(null); submit.mutate(); }}
          />
          <Text variant="caption" color="textMuted" align="center" style={{ marginBottom: insets.bottom }}>
            Tu pago queda en verificación. Lo confirmamos al verlo reflejado; enviar este formulario no lo marca como pagado.
          </Text>
        </Card>
      ) : null}
      <Text variant="caption" color="textMuted" align="center" selectable>Código de este monto: {q.id.slice(0, 8)} (por si escribes a soporte)</Text>
    </View>
  );
}

/** Binance Pay / PayPal: the provider page opens in an in-app browser; the order is credited by the provider's
 * signed notification to our server, so coming back to the app never marks anything as paid. */
function OnlinePay({ quote: q, expired, onStarted }: { quote: PaymentQuote; expired: boolean; onStarted: (number: string) => void }) {
  const key = useRef(intentKey('online'));
  useEffect(() => {
    key.current = intentKey('online');
  }, [q.id]);
  const start = useMutation({
    mutationFn: async () => {
      const r = await api.payments.startOnline(q.id, key.current);
      if (r.status === 'processing' && r.checkout_url) {
        if (Platform.OS === 'web') window.open(r.checkout_url, '_blank', 'noopener');
        else await WebBrowser.openAuthSessionAsync(r.checkout_url, `${brand.scheme}://pay/result`);
      }
      return r;
    },
    onSuccess: (r) => {
      if (r.status === 'failed') return;
      onStarted(r.number);
    },
    onError: () => haptics.warning(),
  });
  const failed = start.data?.status === 'failed';
  return (
    <Card style={{ gap: 14 }}>
      <Text variant="title">Pagar con {q.method.name}</Text>
      <Text color="textSecondary">
        Te llevamos a {q.method.name} para completar el pago del monto exacto. Tu pedido se confirma cuando {q.method.name} nos avisa que el pago fue exitoso.
      </Text>
      {start.error ? <Banner tone="danger" icon="circle-alert" body={(start.error as Error).message} /> : null}
      {failed ? <Banner tone="danger" icon="circle-alert" body="El proveedor no aceptó este intento. Actualiza el monto o elige otro método." /> : null}
      <Button testID="pay-online" title={`Continuar a ${q.method.name}`} size="lg" full loading={start.isPending} disabled={expired} onPress={() => start.mutate()} />
    </Card>
  );
}
