// Typed, error-normalized access to the marketplace backend. Shared by the Expo app and the web panel.
// All business rules (prices, stock, rates, balances, permissions) are enforced in the database; this layer only
// shapes requests and turns database hints into friendly errors (AppError from @kora/core).
import { toAppError, type AppError } from '@kora/core';
import type { KoraClient } from './client';
import type {
  Address,
  Category,
  City,
  CheckoutSummary,
  Claim,
  ClaimWithContext,
  ClaimMessage,
  FulfillmentStep,
  HomeFeed,
  Notification,
  OrderDetail,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  PaymentQuote,
  PlaceOrderResult,
  ProductCard,
  ProductDetail,
  Profile,
  MyReview,
  ProductReviews,
  PricingSnapshot,
  PricingToday,
  ProductCosts,
  ProductPricing,
  RateStatus,
  PushHealth,
  SupportContact,
  RecommendationMetrics,
  StoreProfile,
  Region,
  SearchParams,
  ShippingSelection,
  StartOnlineResult,
  Store,
  SubmitPaymentInput,
  SubmitPaymentResult,
} from './types';

export class ApiError extends Error implements AppError {
  code: string;
  detail?: string;
  override cause?: unknown;
  constructor(e: AppError) {
    super(e.message);
    this.name = 'ApiError';
    this.code = e.code;
    this.detail = e.detail;
    this.cause = e.cause;
  }
}

/** Awaits a supabase-js query and throws ApiError (with Spanish copy) on failure. */
export async function run<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  let res: { data: unknown; error: unknown };
  try {
    res = await p;
  } catch (e) {
    throw new ApiError(toAppError(e));
  }
  if (res.error) throw new ApiError(toAppError(res.error));
  return res.data as T;
}

/** Random idempotency key. Generate once per user intent (e.g. when the checkout screen mounts), not per tap. */
export function newIdempotencyKey(prefix = 'k'): string {
  const c = globalThis.crypto;
  const id = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

// The generated Database type describes jsonb results as Json; these RPC helpers keep call sites typed.
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export function createApi(client: KoraClient) {
  const rpc: Rpc = (fn, args) => (client.rpc as unknown as Rpc)(fn, args);
  const from = (table: string) => (client.from as unknown as (t: string) => any)(table);

  const catalog = {
    home: () => run<HomeFeed>(rpc('home_feed')),
    search: (p: SearchParams = {}) =>
      run<ProductCard[]>(
        rpc('search_products', {
          p_query: p.query ?? null,
          p_category: p.category ?? null,
          p_store: p.store ?? null,
          p_availability: p.availability?.length ? p.availability : null,
          p_min_price: p.minPrice ?? null,
          p_max_price: p.maxPrice ?? null,
          p_sort: p.sort ?? 'relevance',
          p_limit: p.limit ?? 24,
          p_offset: p.offset ?? 0,
          p_collection: p.collection ?? null,
        }),
      ),
    product: (id: string) => run<ProductDetail | null>(rpc('product_detail', { p_id: id })),
    productIdBySlug: async (slug: string) => {
      const rows = await run<{ id: string }[]>(from('products').select('id').eq('slug', slug).limit(1));
      return rows[0]?.id ?? null;
    },
    categories: () => run<Category[]>(from('categories').select('*').eq('active', true).order('sort')),
    store: (slug: string) => run<Store | null>(from('stores').select('*').eq('slug', slug).maybeSingle()),
    recommended: (limit = 12, exclude: string[] = []) =>
      run<ProductCard[]>(rpc('recommended_products', { p_limit: limit, p_exclude: exclude })),
    recentlyViewed: (limit = 12) => run<ProductCard[]>(rpc('recently_viewed', { p_limit: limit })),
    track: (kind: 'view' | 'search' | 'add_to_cart' | 'favorite' | 'category_view' | 'store_view', ids: { productId?: string; categoryId?: string; storeId?: string; query?: string } = {}) =>
      run<void>(
        rpc('track_event', {
          p_kind: kind,
          p_product_id: ids.productId ?? null,
          p_category_id: ids.categoryId ?? null,
          p_store_id: ids.storeId ?? null,
          p_query: ids.query ?? null,
        }),
      ).catch(() => undefined), // signals are best-effort and never block the UI
    rate: (pair = 'USD/VES') => run<RateStatus>(rpc('rate_status', { p_pair: pair })),
    /** The day's gap and the divisas factor per method, to show Zelle/USDT prices (the quote is what charges). */
    pricingToday: () => run<PricingToday>(rpc('pricing_today')),
    /** Support contact the operator sets in the panel (public setting); null when it is not configured. */
    support: async () => {
      const row = await run<{ value: SupportContact } | null>(from('app_settings').select('value').eq('key', 'support').maybeSingle());
      return row?.value ?? null;
    },
    storeProfile: (slug: string) => run<StoreProfile | null>(rpc('store_profile', { p_slug: slug })),
    reviews: (productId: string, limit = 10, offset = 0) =>
      run<ProductReviews>(rpc('product_reviews', { p_product_id: productId, p_limit: limit, p_offset: offset })),
    /** Recommendation impressions (batched) and clicks per slot, used to measure ranking changes. Best effort. */
    trackRecommendation: (slot: string, kind: 'impression' | 'click', productIds: string[]) =>
      run<void>(rpc('track_recommendation', { p_slot: slot, p_kind: kind, p_product_ids: productIds })).catch(() => undefined),
  };

  const reviews = {
    /** Reviews the signed-in buyer wrote for the given order items (own rows are readable under RLS). */
    mine: (orderItemIds: string[]) =>
      orderItemIds.length
        ? run<MyReview[]>(from('reviews').select('id, order_item_id, rating, body, status, created_at').in('order_item_id', orderItemIds))
        : Promise.resolve([] as MyReview[]),
    /** The signed-in buyer's delivered purchases of a product: what they can rate from its page. */
    deliveredItems: (buyerId: string, productId: string) =>
      run<OrderItem[]>(
        from('order_items')
          .select('*, orders!inner(buyer_id), fulfillments!inner(status)')
          .eq('product_id', productId)
          .eq('orders.buyer_id', buyerId)
          .eq('fulfillments.status', 'delivered')
          .limit(10),
      ),
    submit: (orderItemId: string, rating: number, body?: string | null) =>
      run<MyReview>(rpc('submit_review', { p_order_item_id: orderItemId, p_rating: rating, p_body: body ?? null })),
    reply: (reviewId: string, body: string) => run<unknown>(rpc('reply_review', { p_review_id: reviewId, p_body: body })),
    moderate: (reviewId: string, hide: boolean, reason?: string) =>
      run<unknown>(rpc('moderate_review', { p_review_id: reviewId, p_hide: hide, p_reason: reason ?? null })),
  };

  const cart = {
    add: (variantId: string, quantity = 1) => run<unknown>(rpc('cart_add', { p_variant_id: variantId, p_quantity: quantity })),
    setQuantity: (variantId: string, quantity: number) =>
      run<unknown>(rpc('cart_set_quantity', { p_variant_id: variantId, p_quantity: quantity })),
    /** Merges a guest cart (kept on device) into the account after sign in. */
    merge: (lines: { variant_id: string; quantity: number }[]) => run<unknown>(rpc('cart_merge', { p_lines: lines })),
    summary: (addressId?: string | null) => run<CheckoutSummary>(rpc('cart_summary', { p_address_id: addressId ?? null })),
  };

  const checkout = {
    preview: (addressId: string | null, shipping: ShippingSelection, planCode: string | null) =>
      run<CheckoutSummary>(rpc('checkout_preview', { p_address_id: addressId, p_shipping: shipping, p_plan_code: planCode })),
    placeOrder: (addressId: string, shipping: ShippingSelection, planCode: string, idempotencyKey: string) =>
      run<PlaceOrderResult>(
        rpc('place_order', { p_address_id: addressId, p_shipping: shipping, p_plan_code: planCode, p_idempotency_key: idempotencyKey }),
      ),
  };

  const payments = {
    methods: () => run<PaymentMethod[]>(from('payment_methods').select('*').eq('enabled', true).order('sort')),
    quote: (orderId: string, methodCode: string, obligationIds?: string[]) =>
      run<PaymentQuote>(
        rpc('create_payment_quote', { p_order_id: orderId, p_method_code: methodCode, p_obligation_ids: obligationIds ?? null }),
      ),
    submit: (i: SubmitPaymentInput) =>
      run<SubmitPaymentResult>(
        rpc('submit_payment', {
          p_quote_id: i.quoteId,
          p_reference: i.reference ?? null,
          p_proof_path: i.proofPath ?? null,
          p_payer: i.payer ?? {},
          p_idempotency_key: i.idempotencyKey,
        }),
      ),
    /**
     * Online methods (Binance Pay, PayPal): the `payments-start` edge function creates the provider order with
     * server-held credentials and returns where to pay. The payment is confirmed only by the provider's signed
     * webhook, never by the app.
     */
    startOnline: async (quoteId: string, idempotencyKey: string): Promise<StartOnlineResult> => {
      const { data, error } = await client.functions.invoke<StartOnlineResult>('payments-start', { body: { quoteId, idempotencyKey } });
      if (!error && data) return data;
      let body: { error?: string; message?: string } | null = null;
      try {
        body = await (error as { context?: Response } | null)?.context?.json();
      } catch {
        body = null;
      }
      throw new ApiError({
        code: body?.error ?? 'network',
        message: body?.message ?? 'No pudimos iniciar el pago en línea. Revisa tu conexión e intenta de nuevo.',
        cause: error,
      });
    },
    /** Gives up on an online attempt that was never completed, so the buyer can pay another way. */
    cancelOnline: (paymentId: string) => run<null>(rpc('cancel_provider_payment', { p_payment_id: paymentId })),
    /** Uploads a payment proof to the private bucket under the user's own folder and returns its path. */
    uploadProof: async (userId: string, file: Blob | ArrayBuffer | Uint8Array, contentType: string, ext = 'jpg') => {
      const path = `${userId}/${newIdempotencyKey('proof')}.${ext}`;
      const { error } = await client.storage.from('payment-proofs').upload(path, file as Blob, { contentType, upsert: false });
      if (error) throw new ApiError(toAppError(error));
      return path;
    },
  };

  const orders = {
    list: () =>
      run<(Order & { order_items: { title: string; image_path: string | null; quantity: number }[] })[]>(
        from('orders').select('*, order_items(title, image_path, quantity)').order('placed_at', { ascending: false }),
      ),
    detail: (id: string) =>
      run<OrderDetail | null>(
        from('orders')
          .select('*, order_items(*), fulfillments(*, fulfillment_events(*)), payment_obligations(*), payments(*)')
          .eq('id', id)
          .order('seq', { referencedTable: 'payment_obligations' })
          .order('seq', { referencedTable: 'fulfillments' })
          .order('created_at', { referencedTable: 'payments', ascending: false })
          .maybeSingle(),
      ),
    steps: () => run<FulfillmentStep[]>(from('fulfillment_steps').select('*').order('flow').order('seq')),
    cancel: (id: string, reason: string) => run<void>(rpc('cancel_order', { p_order_id: id, p_reason: reason })),
  };

  const account = {
    profile: (userId: string) => run<Profile | null>(from('profiles').select('*').eq('id', userId).maybeSingle()),
    updateProfile: (userId: string, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'preferences' | 'personalization_enabled' | 'marketing_opt_in'>>) =>
      run<Profile>(from('profiles').update(patch).eq('id', userId).select().single()),
    addresses: () => run<Address[]>(from('addresses').select('*').order('is_default', { ascending: false }).order('created_at')),
    saveAddress: (a: Partial<Address> & { user_id: string }) =>
      a.id
        ? run<Address>(from('addresses').update(a).eq('id', a.id).select().single())
        : run<Address>(from('addresses').insert(a).select().single()),
    deleteAddress: (id: string) => run<void>(from('addresses').delete().eq('id', id)),
    regions: (country = 'VE') => run<Region[]>(from('regions').select('*').eq('country_code', country).order('sort')),
    /** Known cities of a state, capital first, to suggest while typing (any city can still be written). */
    cities: (regionCode: string, country = 'VE') =>
      run<City[]>(from('cities').select('*').eq('country_code', country).eq('region_code', regionCode).order('is_capital', { ascending: false }).order('name')),
    favorites: () =>
      run<{ product_id: string; created_at: string }[]>(from('favorites').select('product_id, created_at').order('created_at', { ascending: false })),
    favoriteProducts: async () => {
      const favs = await account.favorites();
      if (!favs.length) return [] as ProductCard[];
      const cards = await run<ProductCard[]>(from('product_cards').select('*').in('id', favs.map((f) => f.product_id)));
      const order = new Map(favs.map((f, i) => [f.product_id, i]));
      return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
    setFavorite: async (userId: string, productId: string, on: boolean) => {
      if (on) await run(from('favorites').upsert({ user_id: userId, product_id: productId }, { ignoreDuplicates: true }));
      else await run(from('favorites').delete().eq('user_id', userId).eq('product_id', productId));
      if (on) void catalog.track('favorite', { productId });
    },
    setStockAlert: async (userId: string, productId: string, on: boolean) => {
      if (on) await run(from('stock_alerts').upsert({ user_id: userId, product_id: productId }, { ignoreDuplicates: true }));
      else await run(from('stock_alerts').delete().eq('user_id', userId).eq('product_id', productId));
    },
    notifications: (limit = 50) =>
      run<Notification[]>(from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)),
    markNotificationsRead: (ids?: string[]) => run<number>(rpc('mark_notifications_read', { p_ids: ids ?? null })),
    registerPushToken: (token: string, platform: 'ios' | 'android' | 'web') =>
      run<void>(rpc('register_push_token', { p_token: token, p_platform: platform })),
    clearActivity: () => run<void>(rpc('clear_my_activity')),
    requestDeletion: (reason?: string) => run<string>(rpc('request_account_deletion', { p_reason: reason ?? null })),
    roles: (userId: string) => run<{ role: string }[]>(from('user_roles').select('role').eq('user_id', userId)),
    stores: (userId: string) =>
      run<{ role: string; stores: Store }[]>(from('store_members').select('role, stores(*)').eq('user_id', userId)),
  };

  const claims = {
    list: () => run<Claim[]>(from('claims').select('*').order('created_at', { ascending: false })),
    forFulfillment: (fulfillmentId: string) =>
      run<ClaimWithContext[]>(
        from('claims').select('*, stores(name), orders(number)').eq('fulfillment_id', fulfillmentId).order('created_at', { ascending: false }),
      ),
    /** Hours a store has to answer before the buyer may escalate (public setting). */
    responseHours: async () => {
      const row = await run<{ value: unknown } | null>(from('app_settings').select('value').eq('key', 'claims.seller_response_hours').maybeSingle());
      return Number(row?.value ?? 48);
    },
    messages: (claimId: string) =>
      run<ClaimMessage[]>(from('claim_messages').select('*').eq('claim_id', claimId).order('created_at')),
    open: (fulfillmentId: string, reason: Claim['reason'], description: string) =>
      run<string>(rpc('open_claim', { p_fulfillment_id: fulfillmentId, p_reason: reason, p_description: description })),
    post: (claimId: string, body: string) => run<void>(rpc('post_claim_message', { p_claim_id: claimId, p_body: body })),
    escalate: (claimId: string) => run<void>(rpc('escalate_claim', { p_claim_id: claimId })),
  };

  const seller = {
    /** Cost structure and price breakdown of a product of the store (docs/PRECIOS.md). */
    productPricing: (productId: string) => run<ProductPricing>(rpc('product_pricing', { p_product_id: productId })),
    setProductCosts: (productId: string, costs: Partial<Omit<ProductCosts, 'product_id' | 'updated_at'>>, variantCosts: { variant_id: string; cost_usd: number | null }[]) =>
      run<ProductPricing>(rpc('set_product_costs', { p_product_id: productId, p_costs: costs as never, p_variant_costs: variantCosts as never })),
    dashboard: (storeId: string) => run<Record<string, any>>(rpc('seller_dashboard', { p_store_id: storeId })),
    balance: (storeId: string) => run<Record<string, number>>(rpc('seller_balance', { p_store_id: storeId })),
    advance: (fulfillmentId: string, step: string, opts: { note?: string; tracking?: string; carrier?: string } = {}) =>
      run<unknown>(
        rpc('advance_fulfillment', {
          p_fulfillment_id: fulfillmentId,
          p_step: step,
          p_note: opts.note ?? null,
          p_tracking: opts.tracking ?? null,
          p_carrier: opts.carrier ?? null,
        }),
      ),
  };

  const admin = {
    dashboard: () => run<Record<string, any>>(rpc('admin_dashboard')),
    pushHealth: () => run<PushHealth>(rpc('push_health')),
    reviewPayment: (paymentId: string, approve: boolean, opts: { amountReceived?: number; reason?: string } = {}) =>
      run<{ status: 'confirmed' | 'rejected'; usd_recognized?: number }>(
        rpc('review_payment', {
          p_payment_id: paymentId,
          p_approve: approve,
          p_amount_received: opts.amountReceived ?? null,
          p_reason: opts.reason ?? null,
        }),
      ),
    pendingPayments: () =>
      run<(Payment & { orders: Pick<Order, 'number' | 'total_usd' | 'paid_usd'> })[]>(
        from('payments').select('*, orders(number, total_usd, paid_usd)').eq('status', 'pending_verification').order('created_at'),
      ),
    moderate: (productId: string, status: 'published' | 'in_review' | 'rejected' | 'suspended' | 'pending', note?: string) =>
      run<void>(rpc('moderate_product', { p_product_id: productId, p_status: status, p_note: note ?? null })),
    setManualRate: (pair: string, rate: number, validMinutes: number, note: string) =>
      run<unknown>(rpc('set_manual_rate', { p_pair: pair, p_rate: rate, p_valid_minutes: validMinutes, p_note: note })),
    refundItem: (orderItemId: string, quantity: number, reason: string, restock = false) =>
      run<{ refunded_usd: number; refund_due_usd: number }>(
        rpc('refund_item', { p_order_item_id: orderItemId, p_quantity: quantity, p_reason: reason, p_restock: restock }),
      ),
    resolveClaim: (claimId: string, status: 'resolved' | 'rejected', resolution: string) =>
      run<void>(rpc('resolve_claim', { p_claim_id: claimId, p_status: status, p_resolution: resolution })),
    createPayout: (storeId: string, amount: number, notes?: string) =>
      run<string>(rpc('create_payout', { p_store_id: storeId, p_amount: amount, p_notes: notes ?? null })),
    markPayoutPaid: (payoutId: string, method: string, reference: string) =>
      run<void>(rpc('mark_payout_paid', { p_payout_id: payoutId, p_method: method, p_reference: reference })),
    /** Takes the day's gap now from the rates in force and reprices the products that follow their cost. */
    takePricingSnapshot: (note?: string) => run<PricingSnapshot & { repriced: number }>(rpc('take_pricing_snapshot', { p_note: note ?? null })),
    pricingSnapshots: (limit = 10) => run<PricingSnapshot[]>(from('pricing_snapshots').select('*').order('taken_at', { ascending: false }).limit(limit)),
    recommendationMetrics: (days = 14) => run<RecommendationMetrics>(rpc('recommendation_metrics', { p_days: days })),
    updateBatch: (batchId: string, step: string, note?: string) =>
      run<{ updated: number; skipped: { fulfillment_id: string; reason: string }[] }>(
        rpc('update_cargo_batch', { p_batch_id: batchId, p_step: step, p_note: note ?? null }),
      ),
  };

  return { client, catalog, cart, checkout, payments, orders, account, claims, seller, admin, reviews };
}

export type Api = ReturnType<typeof createApi>;
