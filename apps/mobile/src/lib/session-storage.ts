import AsyncStorage from '@react-native-async-storage/async-storage';
import { sealedPlaintext, utf8Encode } from '@kora/core';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// Where supabase-js keeps the session. On a phone the tokens are encrypted at rest (AES-256-GCM): the key is
// created on the device and kept in the Android Keystore / iOS Keychain through expo-secure-store, and only the
// sealed session goes to AsyncStorage, since the Keystore is meant for small secrets. The key never leaves the
// device (not even in backups), so a copied AsyncStorage file is useless. The web build keeps the browser's
// storage, as supabase-js does by default.

interface Storage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const KEY_ALIAS = 'kora.session-key.v1';
const SEALED = 'kora-aes1:';

function encryptedStorage(): Storage | null {
  // builds without the native modules (Expo Go, an older test APK) fall back to plain storage
  if (!requireOptionalNativeModule('ExpoSecureStore') || !requireOptionalNativeModule('ExpoCryptoAES')) return null;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  /* eslint-enable @typescript-eslint/no-require-imports */

  let key: Promise<InstanceType<typeof Crypto.AESEncryptionKey>> | null = null;
  const sessionKey = () => {
    key ??= (async () => {
      const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
      const saved = await SecureStore.getItemAsync(KEY_ALIAS, opts);
      if (saved) return Crypto.AESEncryptionKey.import(saved, 'hex');
      const fresh = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
      await SecureStore.setItemAsync(KEY_ALIAS, await fresh.encoded('hex'), opts);
      return fresh;
    })();
    key.catch(() => { key = null; });
    return key;
  };

  const storage: Storage = {
    async setItem(name, value) {
      const sealed = await Crypto.aesEncryptAsync(utf8Encode(value), await sessionKey());
      await AsyncStorage.setItem(name, SEALED + (await sealed.combined('base64')));
    },
    async getItem(name) {
      const stored = await AsyncStorage.getItem(name);
      if (stored == null) return null;
      if (!stored.startsWith(SEALED)) {
        // a session saved in the clear by an earlier version: seal it now
        await storage.setItem(name, stored).catch(() => undefined);
        return stored;
      }
      try {
        const sealed = Crypto.AESSealedData.fromCombined(stored.slice(SEALED.length));
        // Android returns 16 extra zero bytes; sealedPlaintext keeps exactly the ciphertext's length
        return sealedPlaintext(await Crypto.aesDecryptAsync(sealed, await sessionKey(), { output: 'bytes' }), sealed);
      } catch {
        // the key is gone (restored from a backup, app data partly cleared): the session cannot be trusted
        await AsyncStorage.removeItem(name);
        return null;
      }
    },
    removeItem: (name) => AsyncStorage.removeItem(name),
  };
  return storage;
}

const sealedStorage = Platform.OS === 'web' ? null : encryptedStorage();

/** Seals and reads back a throwaway value with the session key (for the diagnostics screen). */
export async function sessionSealSelfTest(): Promise<'ok' | 'not-encrypted' | string> {
  if (!sealedStorage) return 'not-encrypted';
  const name = 'kora.seal-selftest';
  const value = `prueba ñ ✓ ${Date.now()}`;
  try {
    await sealedStorage.setItem(name, value);
    const raw = await AsyncStorage.getItem(name);
    const back = await sealedStorage.getItem(name);
    await sealedStorage.removeItem(name);
    if (!raw?.startsWith(SEALED) || raw.includes('prueba')) return 'stored in the clear';
    return back === value ? 'ok' : 'read back a different value';
  } catch (e) {
    return String((e as Error)?.message ?? e);
  }
}

/** True when sessions on this device are sealed with a key from the device keystore. */
export const sessionEncrypted = sealedStorage !== null;

export const sessionStorage: Storage | undefined =
  Platform.OS === 'web' ? (typeof window === 'undefined' ? undefined : AsyncStorage) : (sealedStorage ?? AsyncStorage);
