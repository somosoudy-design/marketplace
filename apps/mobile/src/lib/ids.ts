import * as Crypto from 'expo-crypto';

/** Idempotency key for one user intent (generated when a flow starts, reused on retries and double taps). */
export const intentKey = (prefix: string) => `${prefix}-${Crypto.randomUUID()}`;
