import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

/** Covers stack back, Android back and browser reload without persisting private drafts on the device. */
export function UnsavedChanges({ dirty, busy = false }: { dirty: boolean; busy?: boolean }) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  usePreventRemove(dirty || busy, ({ data }) => { if (!busy) setPending(data.action); });
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  return <ConfirmSheet visible={!!pending} title="Tienes cambios sin guardar" body="Si sales ahora, perderás los cambios de este formulario." confirm="Salir sin guardar" cancel="Seguir editando" testID="seller-unsaved" onClose={() => setPending(null)} onConfirm={() => { const action = pending; setPending(null); if (action) navigation.dispatch(action); }} />;
}
