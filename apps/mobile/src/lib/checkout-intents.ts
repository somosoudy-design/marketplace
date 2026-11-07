import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCheckoutIntents } from './checkout-intent-state';
import { intentKey } from './ids';

export type { CheckoutOrderSelection, StoredCheckoutAttempt } from './checkout-intent-state';
export const checkoutIntents = createCheckoutIntents(AsyncStorage, () => intentKey('order'));
