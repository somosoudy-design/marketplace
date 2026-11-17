import { palette } from '@kora/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

function NavigationLogo() {
  return <BrandMark compact />;
}

export function AuthScreen({ title, description, children, footer }: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerTitle: NavigationLogo, headerTitleAlign: 'center' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={{ borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <LinearGradient colors={[palette.violet[900], palette.violet[700]]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
            style={[styles.intro, { borderTopLeftRadius: radii.xl - 1, borderTopRightRadius: radii.xl - 1 }]}>
            <Text variant="displayXL" style={{ color: palette.ink[0] }}>{title}</Text>
            <Text variant="body" style={{ color: palette.violet[100] }}>{description}</Text>
          </LinearGradient>
          <View style={styles.form}>{children}</View>
        </View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const authStyles = StyleSheet.create({
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 6 },
  switchAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 3 },
  recovery: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
});

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  intro: { paddingHorizontal: 20, paddingVertical: 20, gap: 6 },
  form: { padding: 18, gap: 14 },
});
