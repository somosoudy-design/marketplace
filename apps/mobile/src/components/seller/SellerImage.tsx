import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

export type PickedImage = { uri: string; type: string; uploaded?: string };
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const IMAGE_LIMIT = 5 * 1024 * 1024;
export async function pickSellerImage(aspect?: [number, number]): Promise<PickedImage | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: !!aspect, aspect, quality: 0.7 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const type = a.mimeType ?? 'image/jpeg';
  if (!IMAGE_TYPES[type]) throw new Error('Elige una imagen JPG, PNG o WebP.');
  if ((a.fileSize ?? 0) > IMAGE_LIMIT) throw new Error('Cada imagen debe pesar menos de 5 MB.');
  return { uri: a.uri, type };
}
export async function imageBytes(image: PickedImage) {
  const bytes = await (await fetch(image.uri)).arrayBuffer();
  if (bytes.byteLength > IMAGE_LIMIT) throw new Error('Cada imagen debe pesar menos de 5 MB.');
  return bytes;
}
export function SellerImage({ label, uri, aspect = 1, disabled, onPick }: { label: string; uri?: string | null; aspect?: number; disabled: boolean; onPick: () => void }) {
  const t = useTheme();
  return <View style={{ gap: 10 }}><Text variant="label">{label}</Text><View style={{ aspectRatio: aspect, width: aspect === 1 ? 96 : '100%', maxHeight: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: t.colors.surfaceSunken }}>
    {uri ? <Image source={{ uri }} accessibilityLabel={`Vista previa: ${label}`} style={{ flex: 1 }} contentFit="cover" /> : <Text align="center" color="textMuted" style={{ margin: 20 }}>Sin imagen</Text>}
  </View><Button title={`Cambiar ${label.toLowerCase()}`} icon="image" variant="secondary" full disabled={disabled} onPress={onPick} /></View>;
}
