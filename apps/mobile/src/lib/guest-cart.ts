import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGuestCart } from './guest-cart-state';

// The legacy array key is preserved; pending merges use a separate durable journal.
export type { GuestLine } from './guest-cart-state';
export const guestCart = createGuestCart(AsyncStorage);
