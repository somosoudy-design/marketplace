import type { MyReview, OrderItem } from '@kora/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { ProductImage } from '@/components/catalog/ProductImage';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { haptics } from '@/lib/haptics';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { StarInput } from './Reviews';

const MAX = 1000;

/** Rate a delivered item. Opens prefilled when the buyer already reviewed it (editable for 60 days). */
export function ReviewSheet({ item, existing, orderId, onClose }: { item: OrderItem | null; existing?: MyReview; orderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  // the sheet is remounted per item (keyed by the caller), so initial state comes straight from props
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const submit = useMutation({
    mutationFn: () => api.reviews.submit(item!.id, rating, body.trim() || null),
    onSuccess: () => {
      haptics.success();
      qc.invalidateQueries({ queryKey: qk.myReviews(orderId) });
      if (item) {
        qc.invalidateQueries({ queryKey: qk.reviews(item.product_id) });
        qc.invalidateQueries({ queryKey: qk.reviewable(item.product_id) });
        qc.invalidateQueries({ queryKey: qk.product(item.product_id) });
      }
      onClose();
    },
    onError: () => haptics.warning(),
  });
  return (
    <Sheet
      visible={!!item}
      title={existing ? 'Editar tu opinión' : '¿Qué tal tu compra?'}
      onClose={onClose}
      testID="review-sheet"
      footer={
        <Button testID="review-submit" title={existing ? 'Guardar cambios' : 'Publicar opinión'} size="lg" full disabled={!rating} loading={submit.isPending} onPress={() => submit.mutate()} />
      }
    >
      {item ? (
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ProductImage path={item.image_path} style={{ width: 44 }} radius={10} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={2}>{item.title}</Text>
              {item.variant_title ? <Text variant="caption" color="textMuted">{item.variant_title}</Text> : null}
            </View>
          </View>
          <StarInput value={rating} onChange={setRating} />
          <TextField
            testID="review-body"
            label="Cuéntale a otros compradores (opcional)"
            value={body}
            onChangeText={(v) => setBody(v.slice(0, MAX))}
            multiline
            placeholder="Calidad, tamaño, cómo llegó…"
            style={{ minHeight: 110, textAlignVertical: 'top' }}
            helper={`${body.length}/${MAX} · Se publica con tu nombre y la inicial de tu apellido.`}
          />
          {submit.error ? <Banner tone="danger" icon="circle-alert" body={(submit.error as Error).message} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}
