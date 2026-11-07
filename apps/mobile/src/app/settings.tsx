import { LegalLinks } from '@/components/account/LegalLinks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { Chip } from '@/components/ui/Chip';
import { Card, Divider } from '@/components/ui/Layout';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/hooks';
import { pushAllowed, registerForPush } from '@/lib/push';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme, type SchemePreference } from '@/theme';

export default function SettingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const profile = useProfile();
  const p = profile.data;
  const [reason, setReason] = useState('');
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  // On the phone the switch is on only when the system also lets the app notify; otherwise turning it on asks.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') pushAllowed().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof api.account.updateProfile>[1]) => api.account.updateProfile(user!.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.profile });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
  const clear = useMutation({ mutationFn: () => api.account.clearActivity(), onSuccess: () => qc.invalidateQueries({ queryKey: qk.home }) });
  const del = useMutation({ mutationFn: () => api.account.requestDeletion(reason || undefined), onSuccess: () => setDeletionRequested(true) });

  const schemes: { v: SchemePreference; l: string }[] = [{ v: 'system', l: 'Automático' }, { v: 'light', l: 'Claro' }, { v: 'dark', l: 'Oscuro' }];
  const notif = ((p?.preferences as Record<string, any> | undefined)?.notifications ?? {}) as Record<string, boolean>;

  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
      <Card style={{ gap: 12 }}>
        <Text variant="title">Apariencia</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {schemes.map((s) => <Chip key={s.v} label={s.l} selected={t.preference === s.v} onPress={() => t.setPreference(s.v)} />)}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="title">Notificaciones</Text>
        <ToggleRow
          title="Avisos en este dispositivo"
          body="Pagos, envíos y reclamos. Nunca enviamos publicidad sin tu permiso."
          testID="settings-push"
          value={notif.push !== false && allowed !== false}
          onChange={async (v) => {
            update.mutate({ preferences: { ...(p?.preferences as object), notifications: { ...notif, push: v } } });
            if (!v) return setPushStatus(null);
            setPushStatus(await registerForPush());
            if (Platform.OS !== 'web') setAllowed(await pushAllowed().catch(() => false));
          }}
        />
        {pushStatus ? <Text variant="caption" color="textMuted" testID="settings-push-status">{pushStatus}</Text> : null}
        <Divider />
        <ToggleRow title="Novedades y ofertas" body="Correos ocasionales con lanzamientos." value={!!p?.marketing_opt_in} onChange={(v) => update.mutate({ marketing_opt_in: v })} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="title">Privacidad</Text>
        <ToggleRow
          title="Recomendaciones personalizadas"
          body="Usamos lo que ves y compras en esta tienda para ordenar sugerencias. Puedes desactivar estas recomendaciones."
          value={p?.personalization_enabled !== false}
          onChange={(v) => update.mutate({ personalization_enabled: v })}
        />
        <Button title={clear.isSuccess ? 'Historial borrado' : 'Borrar mi historial de navegación'} variant="secondary" size="sm" disabled={clear.isSuccess} loading={clear.isPending} onPress={() => clear.mutate()} />
      </Card>

      <LegalLinks />

      <Card style={{ gap: 12 }}>
        <Text variant="title">Eliminar cuenta</Text>
        {deletionRequested || del.isSuccess ? (
          <Banner tone="success" icon="circle-check" title="Solicitud recibida" body="Recibimos tu solicitud para revisión. Todavía no se ha completado la eliminación; tu cuenta sigue funcionando mientras se tramita. Consulta el alcance en Eliminar cuenta y datos." />
        ) : (
          <>
            <Text variant="bodySmall" color="textSecondary">Puedes solicitar la eliminación de tu cuenta y sus datos. La solicitud se revisa antes de procesarse. Consulta Eliminar cuenta y datos para conocer el alcance y la información que permanece después del cierre.</Text>
            <TextField label="Motivo (opcional)" value={reason} onChangeText={setReason} />
            <Button testID="request-deletion" title="Solicitar eliminación" variant="danger" onPress={() => setConfirmDeletion(true)} />
          </>
        )}
      </Card>
      <ConfirmSheet
        visible={confirmDeletion && !del.isSuccess}
        testID="request-deletion-sheet"
        title="¿Solicitar la eliminación de tu cuenta?"
        body="Esta acción envía una solicitud para revisión; no borra los datos de inmediato. Puede haber operaciones pendientes e información que permanezca tras el cierre. Consulta Eliminar cuenta y datos antes de continuar."
        confirm="Solicitar eliminación"
        cancel="Conservar mi cuenta"
        loading={del.isPending}
        error={del.error ? (del.error as Error).message : null}
        onConfirm={() => del.mutate()}
        onClose={() => setConfirmDeletion(false)}
      />
    </ScrollView>
  );
}

function ToggleRow({ title, body, value, onChange, testID }: { title: string; body: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subtitle" style={{ fontSize: 15 }}>{title}</Text>
        <Text variant="caption" color="textMuted">{body}</Text>
      </View>
      <Switch testID={testID} accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }} />
    </View>
  );
}
