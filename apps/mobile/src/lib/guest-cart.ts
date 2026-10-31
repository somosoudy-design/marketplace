import AsyncStorage from '@react-native-async-storage/async-storage';

// Visitors can fill a cart before creating an account. Lines keep a display snapshot only; prices, stock and
// totals are recalculated by the server when the cart is merged at sign in.
export interface GuestLine {
  variant_id: string;
  product_id: string;
  quantity: number;
  title: string;
  variant_title: string | null;
  image_path: string | null;
  price_usd: number;
  availability: string;
}

const KEY = 'kora.guest-cart.v1';
type Listener = (lines: GuestLine[]) => void;
const listeners = new Set<Listener>();
let cache: GuestLine[] | null = null;

async function read(): Promise<GuestLine[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as GuestLine[];
  } catch {
    cache = [];
  }
  return cache;
}
async function write(lines: GuestLine[]) {
  cache = lines;
  listeners.forEach((l) => l(lines));
  await AsyncStorage.setItem(KEY, JSON.stringify(lines)).catch(() => undefined);
}

export const guestCart = {
  read,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  async add(line: GuestLine) {
    const lines = [...(await read())];
    const i = lines.findIndex((x) => x.variant_id === line.variant_id);
    if (i >= 0) lines[i] = { ...lines[i]!, quantity: Math.min(lines[i]!.quantity + line.quantity, 20) };
    else lines.push(line);
    await write(lines);
  },
  async setQuantity(variantId: string, quantity: number) {
    const lines = (await read()).map((l) => (l.variant_id === variantId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0);
    await write(lines);
  },
  /** Lines to send to the server merge. The local cart is cleared only after the merge succeeds. */
  async mergeLines() {
    return (await read()).map((l) => ({ variant_id: l.variant_id, quantity: l.quantity }));
  },
  async clear() {
    await write([]);
  },
};
