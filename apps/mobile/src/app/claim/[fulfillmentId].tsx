import { CLAIM_REASON_LABEL } from '@kora/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { RadioRow } from '@/components/checkout/Rows';
import { Button } from '@/components/ui/Button';
import { Card, Divider } from '@/components/ui/Layout';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function ClaimScreen() {
  const { fulfillmentId } = useLocalSearchParams<{ fulfillmentId: string }>();
  const t = useTheme();
  const qc = useQueryClient();
  const [reason, setReason] = useState<string>('not_received');
  const [description, setDescription] = useState('');
  const open = useMutation({
    mutationFn: () => api.claims.open(fulfillmentId, reason as never, description.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });

  if (open.isSuccess) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 14, backgroundColor: t.colors.background }}>
        <Banner tone="success" icon="circle-check" title="Reclamo enviado" body="La tienda tiene un plazo para responder. Si no hay solución, puedes escalarlo y lo revisa nuestro equipo." />
        <Button title="Listo" onPress={() => router.back()} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text color="textSecondary">Cuéntanos qué pasó con esta entrega. La tienda verá tu mensaje y te responderá aquí.</Text>
        <Card padded={false}>
          {Object.entries(CLAIM_REASON_LABEL).map(([k, label], i) => (
            <View key={k}>
              {i > 0 ? <Divider inset={16} /> : null}
              <RadioRow selected={reason === k} title={label} onPress={() => setReason(k)} />
            </View>
          ))}
        </Card>
        <TextField label="Describe el problema" value={description} onChangeText={setDescription} multiline style={{ minHeight: 110, textAlignVertical: 'top' }} helper="Mínimo 10 caracteres. Incluye lo que esperabas recibir." />
        {open.error ? <Banner tone="danger" icon="circle-alert" body={(open.error as Error).message} /> : null}
        <Button title="Enviar reclamo" size="lg" full disabled={description.trim().length < 10} loading={open.isPending} onPress={() => open.mutate()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
