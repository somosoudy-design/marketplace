import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGuestFavorites } from '@kora/core';

// Guest choices and each account's unconfirmed receipt stay durable outside account query cache.
export const guestFavorites = createGuestFavorites(AsyncStorage);
export const guestFavoritesKey = ['guest-favorites'] as const;
export const pendingFavoritesKey = (actorId: string | undefined) => ['pending-favorite-merge', actorId] as const;
