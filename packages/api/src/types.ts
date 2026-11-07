// Shapes of the JSON documents returned by the database RPCs (see supabase/migrations).
// Money arrives as JSON numbers with at most 2 decimals (USD) or 8 (rates); convert with @kora/core money helpers
// before doing arithmetic. The backend is the source of truth for every amount shown here.
import type { Database, Json } from './database.types';
import type { ProductCondition, VariantImageLink } from '@kora/core';
export type { ProductCondition } from '@kora/core';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type Availability = Enums['availability'];
export type FulfillmentFlow = Enums['fulfillment_flow'];
export type OrderStatus = Enums['order_status'];
export type OrderPaymentStatus = Enums['order_payment_status'];
export type PaymentStatus = Enums['payment_status'];
export type ModerationStatus = Enums['moderation_status'];
export type StoreKind = Enums['store_kind'];

export type Order = Tables['orders']['Row'];
export type OrderItem = Tables['order_items']['Row'] & { product_condition?: ProductCondition | null };
export type Fulfillment = Tables['fulfillments']['Row'];
export type FulfillmentEvent = Tables['fulfillment_events']['Row'];
export type FulfillmentStep = Tables['fulfillment_steps']['Row'];
export type PaymentObligation = Tables['payment_obligations']['Row'];
export type Payment = Tables['payments']['Row'];
export type PaymentMethod = Tables['payment_methods']['Row'];
export type Address = Tables['addresses']['Row'];
export type Store = Tables['stores']['Row'];
export type Category = Tables['categories']['Row'];
export type Notification = Tables['notifications']['Row'];
export type Profile = Tables['profiles']['Row'];
export type Region = Tables['regions']['Row'];
export type City = Tables['cities']['Row'];
export type Claim = Tables['claims']['Row'];
export type ClaimMessage = Tables['claim_messages']['Row'];
export type ClaimWithContext = Claim & { stores: { name: string } | null; orders: { number: string } | null };

export interface ProductCard {
  condition?: ProductCondition | null;
  available_colors?: string[];
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_kind: StoreKind;
  store_status: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  tone: string;
  brand_name: string | null;
  availability: Availability;
  origin: 'local' | 'import' | 'seller';
  price_usd: number;
  compare_at_usd: number | null;
  image_path: string | null;
  stock_total: number | null;
  lead_min_days: number | null;
  lead_max_days: number | null;
  popularity: number;
  published_at: string | null;
  is_demo: boolean;
  moderation_status: ModerationStatus;
  rating_avg: number | null;
  rating_count: number;
}

export interface ProductVariant {
  sku?: string | null;
  media_classified?: boolean;
  updated_at?: string;
  id: string;
  title: string;
  options: Record<string, string>;
  price_usd: number;
  stock: number | null;
  active: boolean;
}

export interface ProductDetail extends ProductCard {
  /** Server eligibility per variant/quantity. Amounts are product-only until checkout includes delivery. */
  installment_options?: ProductInstallmentOffer[];
  /** Present in the reviewed endpoint; shares the detail's database snapshot. */
  catalog_metadata?: CatalogMetadata;
  /** Server-confirmed images not assigned to any variant, including hidden/inactive variants. */
  general_images?: { id: string; path: string; alt: string | null; width: number | null; height: number | null; sort: number }[];
  variant_image_links?: VariantImageLink[];
  description: string | null;
  highlights: string[] | null;
  option_names: string[] | null;
  max_per_order: number;
  weight_kg: number | null;
  images: { id?: string; path: string; alt: string | null; width: number | null; height: number | null }[];
  variants: ProductVariant[];
  store: {
    id: string;
    name: string;
    slug: string;
    logo_path: string | null;
    accent: string;
    kind: StoreKind;
    shipping_info: string | null;
    rating_avg: number | null;
    rating_count: number;
  };
  is_favorite: boolean;
  alert_requested: boolean;
  related: ProductCard[];
}

export interface StoreSummary {
  id: string;
  kind: StoreKind;
  name: string;
  slug: string;
  accent: string;
  tagline: string | null;
  logo_path: string | null;
  cover_path: string | null;
  rating_avg?: number | null;
  rating_count?: number;
}

export interface CategorySummary {
  id: string;
  icon: string | null;
  name: string;
  slug: string;
  tone: string;
  /** Photo of the category's most popular product, so the tile shows a product rather than an icon. */
  image_path?: string | null;
}

export interface CollectionBlock {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  tone: string;
  layout: 'feature' | 'rail' | 'grid' | string;
  cover_path?: string | null;
  products: ProductCard[];
}

export interface HomeFeed {
  stores: StoreSummary[];
  categories: CategorySummary[];
  collections: CollectionBlock[];
  recommended: ProductCard[];
  recently_viewed: ProductCard[];
  personalized: boolean;
}

export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';

export interface SearchParams {
  query?: string | null;
  category?: string | null;
  store?: string | null;
  collection?: string | null;
  availability?: Availability[] | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

export interface ShippingOption {
  code: string;
  kind: 'home_delivery' | 'office_pickup' | 'store_pickup' | string;
  name: string;
  carrier: string;
  is_demo: boolean;
  cost_usd: number;
  min_days: number;
  max_days: number;
  method_id: string;
  eta_min_date: string;
  eta_max_date: string;
}

export interface CartLine {
  product_condition?: ProductCondition | null;
  sku?: string | null;
  image_scope?: 'general' | 'variant';
  issue: null | 'sold_out' | 'unavailable' | 'insufficient_stock' | 'over_limit';
  title: string;
  quantity: number;
  image_path: string | null;
  product_id: string;
  variant_id: string;
  availability: Availability;
  max_quantity: number;
  variant_title: string | null;
  line_total_usd: number;
  unit_price_usd: number;
}

export interface DeliveryGroup {
  key: string;
  seq: number;
  flow: FulfillmentFlow;
  label: string;
  lines: CartLine[];
  store: { id: string; kind: StoreKind; name: string; slug: string };
  weight_kg: number;
  subtotal_usd: number;
  ready_min_days: number;
  ready_max_days: number;
  /** null until the buyer picks an address (or when the group has nothing purchasable). */
  shipping_options: ShippingOption[] | null;
  selected_shipping: ShippingOption | null;
}

export interface PlanOption {
  code: string;
  name: string;
  description: string | null;
  installments: number;
  interval_days: number;
  surcharge_pct: number;
  down_payment_pct: number;
}

export interface ProductPaymentOption extends PlanOption { min_quantity: number; max_quantity: number }
export interface ProductInstallmentOffer {
  variant_id: string;
  unit_price_usd: number;
  max_quantity: number;
  basis: 'products_only_excludes_shipping';
  plans: ProductPaymentOption[];
}

export interface ScheduleItem {
  seq: number;
  kind: Enums['obligation_kind'];
  amount_usd: number;
  due_in_days: number;
}

export interface CheckoutSummary {
  plan: (PlanOption & { allowed_flows: FulfillmentFlow[] }) | null;
  plans: PlanOption[];
  groups: DeliveryGroup[];
  issues: number;
  address: Address | null;
  schedule: ScheduleItem[];
  can_place: boolean;
  items_usd: number;
  shipping_usd: number;
  financing_usd: number;
  total_usd: number;
  line_count: number;
  needs_address: boolean;
  needs_shipping: boolean;
}

/** Shipping choice per delivery group key: { [group.key]: method_id (or method code) from group.shipping_options }. */
export type ShippingSelection = Record<string, string>;

export interface PlaceOrderResult {
  order_id: string;
  number: string;
  replayed: boolean;
}

export interface PaymentQuote {
  id: string;
  order_id: string;
  method_code: string;
  obligation_ids: string[];
  base_usd: number;
  fee_usd: number;
  currency: 'USD' | 'VES' | 'USDT' | string;
  rate_pair: string;
  rate_base: number;
  rate_applied: number;
  rate_source: string;
  rate_observed_at: string;
  amount_due: number;
  status: 'open' | 'used' | 'expired' | 'cancelled';
  issued_at: string;
  expires_at: string;
  /** 'divisas': converted with the day's gap (Zelle, USDT); 'bcv': at the method's rate */
  price_basis?: 'bcv' | 'divisas';
  pricing_snapshot_id?: number | null;
  gap_pct?: number | null;
  /** present on divisas quotes: the rates behind the factor and the price in BCV dollars it replaces */
  divisas?: { gap_pct: number; bcv_rate: number; usdt_ves_rate: number; usd_usdt_rate: number; taken_at: string; main_usd: number } | null;
  method: {
    code: string;
    name: string;
    kind: 'manual' | 'automated';
    rail: string;
    requires_reference: boolean;
    requires_proof: boolean;
    instructions: Record<string, unknown>;
    integration_status: string;
  };
}

export interface SubmitPaymentInput {
  quoteId: string;
  reference?: string | null;
  proofPath?: string | null;
  payer?: { name?: string; bank?: string; phone?: string; paid_at?: string };
  idempotencyKey: string;
}

/** Answer of the payments-start edge function. `checkout_url` is the provider page where the buyer pays. */
export interface StartOnlineResult {
  payment_id: string;
  number: string;
  status: 'processing' | 'confirmed' | 'failed' | 'pending_verification' | 'rejected' | 'refunded';
  checkout_url: string | null;
}

export type SubmitPaymentResult =
  | (Payment & { replayed: boolean; error?: undefined })
  | { error: 'quote_expired' | 'obligation_already_paid' };

export type RateStatus =
  | { pair: string; available: true; rate: number; base: number; source: string; observed_at: string; is_fallback: boolean; is_manual: boolean }
  | { pair: string; available: false; reason: 'stale_or_missing'; last: { rate: number; source: string; observed_at: string } | null };

/** The day's gap and the factor of each divisas method (pricing_today; docs/PRECIOS.md). Display only: quotes decide. */
export type PricingToday =
  | {
      available: true;
      snapshot: { id: number; taken_at: string; valid_until: string; bcv_rate: number; bcv_source: string; usdt_ves_rate: number; usdt_source: string; usd_usdt_rate: number; gap_pct: number };
      methods: { code: string; name: string; currency: 'USD' | 'USDT'; factor: number }[];
    }
  | { available: false; reason: 'disabled' | 'no_snapshot' };

/** One price built from its cost (product_pricing / priceFromCost). Null prices when there is no gap in force. */
export interface PriceBreakdownRow {
  cost_usd: number; freight_usd: number; logistics_usd: number; landed_usd: number; margin_pct: number; margin_usd: number;
  target_divisas_usd: number; gap_pct: number | null; price_usd: number | null; price_ves: number | null;
  price_divisas_usd: number | null; divisas_discount_pct: number | null; profit_usd: number | null; profit_pct: number | null;
}

export interface ProductCosts {
  product_id: string; source: 'amazon' | 'proveedor' | 'propio' | 'otro'; source_url: string | null; freight_usd: string | null;
  logistics_usd: string | null; margin_pct: string | null; auto_price: boolean; notes: string | null; updated_at: string;
}

export interface PricingSnapshot {
  id: number; taken_at: string; valid_until: string; bcv_rate: string; bcv_source: string; bcv_observed_at: string;
  usdt_ves_rate: string; usdt_source: string; usdt_observed_at: string; usd_usdt_rate: string; usd_usdt_source: string;
  gap_pct: string; taken_by: string | null; note: string | null;
}

export interface ProductPricing {
  product_id: string;
  weight_kg: number;
  costs: ProductCosts | null;
  rule: { markup_pct: number; per_kg_usd: number; fixed_usd: number; round_to: number | null; configured?: boolean };
  snapshot: PricingSnapshot | null;
  variants: { variant_id: string; title: string; price_usd: number; cost_usd: number | null; breakdown: PriceBreakdownRow | null }[];
}

export interface OrderDetail extends Order {
  order_items: OrderItem[];
  fulfillments: (Fulfillment & { fulfillment_events: FulfillmentEvent[] })[];
  payment_obligations: PaymentObligation[];
  payments: Payment[];
}

export interface SellerDashboard {
  balance: Record<string, number>;
  to_prepare: number;
  in_transit: number;
  sales_30d_usd: number;
  units_30d: number;
  products: Partial<Record<ModerationStatus, number>> | null;
  low_stock: number;
  claims_open: number;
}

/** Same RLS-protected catalogue read used by the seller panel; no costs or financial fields. */
export type SellerProduct = Pick<Tables['products']['Row'], 'id' | 'store_id' | 'title' | 'base_price_usd' | 'availability' | 'moderation_status' | 'moderation_note' | 'is_demo'> & {
  product_images: { path: string; sort: number }[];
};

/** Delivery scoped to one store by seller_fulfillments; never the other stores' order totals. */
export type SellerFulfillment = Pick<Fulfillment, 'id' | 'store_id' | 'flow' | 'status' | 'order_id' | 'seq' | 'shipping_method_name' | 'tracking_number' | 'carrier_name' | 'shipping_kind' | 'ship_to'> & {
  order_number: string;
  placed_at: string;
  order_status: OrderStatus;
  payment_level: 'none' | 'down_payment' | 'full';
  fulfillment_events: Pick<FulfillmentEvent, 'id' | 'step_code' | 'note' | 'source' | 'visible_to_buyer' | 'created_at'>[];
  items: Pick<OrderItem, 'id' | 'title' | 'variant_title' | 'quantity' | 'refunded_qty' | 'image_path'>[];
};

// ---------- reviews ----------
export interface ReviewSummary {
  count: number;
  avg: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  author: string;
  variant_title?: string | null;
  product_title?: string;
  reply_body?: string | null;
  reply_at?: string | null;
  is_demo?: boolean;
  mine?: boolean;
}

export interface ProductReviews {
  summary: ReviewSummary;
  items: PublicReview[];
}

export interface MyReview {
  id: string;
  order_item_id: string;
  rating: number;
  body: string | null;
  status: 'published' | 'hidden';
  created_at: string;
}

export interface StoreProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_path: string | null;
  cover_path: string | null;
  accent: string;
  kind: StoreKind;
  status: string;
  shipping_info: string | null;
  policies: Record<string, string>;
  rating_avg: number | null;
  rating_count: number;
  is_demo: boolean;
  since: string;
  product_count: number;
  categories: { slug: string; name: string; count: number }[];
  reviews: PublicReview[];
}

export interface RecommendationMetrics {
  from: string;
  ranking: Record<string, unknown>;
  events: number;
  demo_events: number;
  slots: { slot: string; impressions: number; clicks: number; ctr_pct: number | null; users: number; added_to_cart: number; purchased: number }[];
  top_clicked: { id: string; title: string; clicks: number }[];
}

/** Health of the phone notification channel over the last 24 hours (admin dashboard). */
export interface PushHealth {
  devices: number;
  sent_24h: number;
  failed_24h: number;
  /** Receipts: delivered by Apple/Google, or refused by them. */
  confirmed_24h: number;
  rejected_24h: number;
  /** Notifications waiting longer than the dispatcher's schedule allows. */
  stuck: number;
  /** Last time Expo, Apple or Google refused our credentials, if in the last 24 hours. */
  credentials_error: string | null;
}

/** Public support contact (app_settings 'support'), validated by the database. */
export interface SupportContact {
  email: string;
  hours: string;
}

/** Only editable seller profile fields, matching the existing web panel. */
export type SellerStoreInput = Pick<Store, "name" | "tagline" | "description" | "contact_email" | "shipping_info" | "policies" | "accent" | "logo_path" | "cover_path">;

export type SellerEditableProduct = Tables['products']['Row'] & {
  product_images: Pick<Tables['product_images']['Row'], 'id' | 'path' | 'sort'>[];
  product_variants: Pick<Tables['product_variants']['Row'], 'id' | 'title' | 'sku' | 'price_usd' | 'stock' | 'active' | 'sort'>[];
  moderation_events: Pick<Tables['moderation_events']['Row'], 'id' | 'to_status' | 'note' | 'automatic' | 'created_at'>[];
};
export interface SellerProductInput {
  fields: Pick<SellerEditableProduct, 'title' | 'subtitle' | 'description' | 'category_id' | 'availability' | 'highlights' | 'compare_at_usd' | 'weight_kg' | 'max_per_order'>;
  variants: SellerEditableProduct['product_variants'];
  images: SellerEditableProduct['product_images'];
  costs?: Partial<ProductCosts>;
  variantCosts?: { variant_id: string; cost_usd: number | null }[];
}

/** Opt-in contracts: require the reviewed backend schema; legacy methods remain unchanged. */
export interface CatalogVariantMetadata {
  sku?: string | null;
  variant_id: string;
  title: string;
  options: Record<string, string>;
  price_usd: number;
  stock: number | null;
  active: boolean;
  updated_at: string;
  color: string | null;
  media_classified: boolean;
  media_state: 'unknown' | 'none' | 'mapped';
  images: { id: string; path: string; alt: string | null; width: number | null; height: number | null; sort: number }[];
}
export interface CatalogMetadata {
  general_images?: { id: string; path: string; alt: string | null; width: number | null; height: number | null; sort: number }[];
  product_id: string;
  condition: ProductCondition | null;
  updated_at: string;
  colors: string[];
  variants: CatalogVariantMetadata[];
}
export interface CatalogConditionResult {
  product_id: string;
  condition: ProductCondition | null;
  updated_at: string;
}
export interface CatalogMediaResult {
  product_id: string;
  variant_id: string;
  updated_at: string;
  media_classified: true;
  media_state: 'none' | 'mapped';
}
export type ReviewedCheckoutSummary = CheckoutSummary & { review_token: string };
export interface FavoriteMergeIntentResult {
  accepted: number;
  inserted: number;
  product_ids: string[];
  replayed: boolean;
}
export interface CartIntentResult {
  variant_id: string;
  quantity: number;
  replayed: boolean;
}
export interface CartMergeIntentResult {
  accepted: number;
  replayed: boolean;
}

/** Cancellation never undoes a completed mutation. Its result is historical; refresh the cart. */
export type CartIntentCancellation =
  | { state: 'cancelled'; operation: 'add' | 'merge'; replayed: boolean }
  | { state: 'completed'; operation: 'add'; result: Omit<CartIntentResult, 'replayed'>; replayed: true }
  | { state: 'completed'; operation: 'merge'; result: Omit<CartMergeIntentResult, 'replayed'>; replayed: true };
export type CartCancelInput =
  | { operation: 'add'; payload: { variant_id: string; quantity: number } }
  | { operation: 'merge'; payload: { variant_id: string; quantity: number }[] };

/** JSON metadata read from legacy rows is not silently asserted to be a string map. */
export type SellerReviewedProduct = Omit<SellerEditableProduct, 'product_variants' | 'product_images'> & {
  condition?: ProductCondition | null;
  product_variants: (Tables['product_variants']['Row'] & { media_classified?: boolean })[];
  product_images: Tables['product_images']['Row'][];
};
/** This RPC returns JSON numbers; retain legacy pricing types for the existing consumers. */
export type SellerReviewedPricing = Omit<ProductPricing, 'costs' | 'snapshot' | 'rule'> & {
  costs: Tables['product_costs']['Row'] | null;
  snapshot: Tables['pricing_snapshots']['Row'] | null;
  rule: Json;
};
export interface SellerProductReview {
  product: SellerReviewedProduct;
  revision: string;
  pricing: SellerReviewedPricing;
}
export interface SellerProductChanges {
  fields?: Partial<SellerProductInput['fields']> & { option_names?: string[] };
  variants?: (Partial<SellerEditableProduct['product_variants'][number]> & {
    id: string;
    options?: Record<string, string>;
  })[];
  /** Omission preserves an image. Removal must be explicit and cannot include other edits. */
  images?: ({ id: string; path?: string; sort?: number; alt?: string | null; remove?: never } | { id: string; remove: true })[];
  costs?: Partial<
    Pick<
      Tables['product_costs']['Row'],
      'source' | 'source_url' | 'freight_usd' | 'logistics_usd' | 'margin_pct' | 'auto_price' | 'notes'
    >
  >;
  /** Requires an explicit costs patch, even {}. Null removes only this variant's cost. */
  variantCosts?: { variant_id: string; cost_usd: number | null }[];
}
export interface SellerProductSaveResult {
  product_id: string;
  revision: string;
  replayed: boolean;
}
