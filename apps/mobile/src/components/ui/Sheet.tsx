import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Bottom sheet with a grab handle, a scrim that closes it and a scrollable body. */
export function Sheet({ visible, title, onClose, children, footer, testID }: { visible: boolean; title?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; testID?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: t.colors.overlay }} />
      <View
        testID={testID}
        style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: t.radii.xl, borderTopRightRadius: t.radii.xl, paddingBottom: insets.bottom + 16, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '88%' }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.borderStrong, marginBottom: 12 }} />
        {title ? <Text variant="title" style={{ paddingHorizontal: 20, marginBottom: 8 }} accessibilityRole="header">{title}</Text> : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, marginTop: 8, gap: 10 }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}
