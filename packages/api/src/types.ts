// Shapes of the JSON documents returned by the database RPCs (see supabase/migrations).
// Money arrives as JSON numbers with at most 2 decimals (USD) or 8 (rates); convert with @kora/core money helpers
// before doing arithmetic. The backend is the source of truth for every amount shown here.
import type { Database } from './database.types';

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
export type OrderItem = Tables['order_items']['Row'];
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
export type Claim = Tables['claims']['Row'];
export type ClaimMessage = Tables['claim_messages']['Row'];

export interface ProductCard {
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
}

export interface ProductVariant {
  id: string;
  title: string;
  options: Record<string, string>;
  price_usd: number;
  stock: number | null;
  active: boolean;
}

export interface ProductDetail extends ProductCard {
  description: string | null;
  highlights: string[] | null;
  option_names: string[] | null;
  max_per_order: number;
  weight_kg: number | null;
  images: { path: string; alt: string | null; width: number | null; height: number | null }[];
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
}

export interface CategorySummary {
  id: string;
  icon: string | null;
  name: string;
  slug: string;
  tone: string;
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

export type SubmitPaymentResult =
  | (Payment & { replayed: boolean; error?: undefined })
  | { error: 'quote_expired' | 'obligation_already_paid' };

export type RateStatus =
  | { pair: string; available: true; rate: number; base: number; source: string; observed_at: string; is_fallback: boolean; is_manual: boolean }
  | { pair: string; available: false; reason: 'stale_or_missing'; last: { rate: number; source: string; observed_at: string } | null };

export interface OrderDetail extends Order {
  order_items: OrderItem[];
  fulfillments: (Fulfillment & { fulfillment_events: FulfillmentEvent[] })[];
  payment_obligations: PaymentObligation[];
  payments: Payment[];
}

export interface SellerDashboard {
  store: Store;
  [k: string]: unknown;
}
