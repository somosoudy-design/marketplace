import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconButton } from './IconButton';

/** Bottom sheet with a grab handle, a scrim that closes it and a scrollable body. */
export function Sheet({ visible, title, onClose, children, footer, testID, dismissible = true }: { visible: boolean; title?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; testID?: string; /** Keep an in-flight operation and its result visible. */ dismissible?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const close = () => { if (dismissible) onClose(); };
  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} transparent onRequestClose={close} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" disabled={!dismissible} onPress={close} style={{ flex: 1, backgroundColor: t.colors.overlay }} />
      <View
        testID={testID}
        accessibilityViewIsModal
        onAccessibilityEscape={close}
        style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: t.radii.xl, borderTopRightRadius: t.radii.xl, paddingBottom: insets.bottom + 16, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '88%' }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.borderStrong, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, gap: 12, marginBottom: 12 }}>
          {title ? <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">{title}</Text> : <View style={{ flex: 1 }} />}
          <IconButton icon="x" label="Cerrar opciones" disabled={!dismissible} onPress={close} tone="surface" testID={testID ? `${testID}-close` : undefined} />
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, marginTop: 8, gap: 10, borderTopWidth: 1, borderColor: t.colors.border }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}
