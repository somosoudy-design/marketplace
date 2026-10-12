import { forwardRef, useId, useState } from 'react';
import { Platform, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { IconButton } from './IconButton';
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
  const messageId = `${useId()}-message`;
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.border;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: focused || error ? 2 : 1, borderColor, borderRadius: radii.md, backgroundColor: colors.surface, minHeight: 50 }}>
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? messageId : undefined}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          style={[typography.body, { flex: 1, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null, style]}
        />
        {secureToggle ? (
          <IconButton icon={hidden ? 'eye' : 'eye-off'} label={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'} onPress={() => setHidden((h) => !h)} color={colors.textMuted} style={{ marginRight: 4 }} />
        ) : null}
      </View>
      {error ? <Text nativeID={messageId} variant="caption" color="danger" accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text nativeID={messageId} variant="caption" color="textMuted">{helper}</Text> : null}
    </View>
  );
});
