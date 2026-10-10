import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  helper?: string;
  secureToggle?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, helper, secureToggle, style, secureTextEntry, ...rest }, ref) {
  const { colors, radii, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.border;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: focused || error ? 1.5 : 1, borderColor, borderRadius: radii.md, backgroundColor: colors.surface, minHeight: 50 }}>
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          style={[typography.body, { flex: 1, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 }, style]}
        />
        {secureToggle ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'} onPress={() => setHidden((h) => !h)} hitSlop={10} style={{ paddingHorizontal: 14 }}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text variant="caption" color="danger" accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text variant="caption" color="textMuted">{helper}</Text> : null}
    </View>
  );
});
