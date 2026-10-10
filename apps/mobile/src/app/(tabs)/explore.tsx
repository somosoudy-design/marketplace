import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Catalog } from '@/components/catalog/Catalog';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

export default function ExploreScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Catalog
        testID="explore-list"
        autoFocusKey={focus}
        topInset={insets.top + 8}
        header={<Text variant="displayL" accessibilityRole="header" style={{ paddingHorizontal: 16, marginBottom: 2 }}>Buscar</Text>}
      />
    </View>
  );
}
