import { OTP_LENGTH, otpDigits } from '@kora/core';
import { forwardRef, useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Called once the last digit is in, typed or pasted. */
  onComplete?: (code: string) => void;
  /** Bumped by the screen after a wrong code: the boxes shake and turn red until the next keystroke. */
  errorKey?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  testID?: string;
}

// One real text field stretched invisibly over six boxes: the keyboard, paste ("Tu código: 482 913"), the
// keyboard's code suggestion and screen readers all work on the field, and the boxes only draw its value.
export const CodeInput = forwardRef<TextInput, Props>(function CodeInput({ value, onChange, onComplete, errorKey = 0, disabled, autoFocus, testID }, ref) {
  const { colors, radii, typography } = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  const shake = useSharedValue(0);
  const caret = useSharedValue(1);

  useEffect(() => {
    if (!errorKey) return;
    setShowError(true);
    if (!reduced) shake.value = withSequence(...[-8, 8, -6, 6, -3, 0].map((x) => withTiming(x, { duration: 55 })));
  }, [errorKey, reduced, shake]);

  useEffect(() => {
    caret.value = reduced ? 1 : withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1);
  }, [reduced, caret]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  const change = (text: string) => {
    const digits = text.replace(/\D/g, '');
    // typing or pasting into a full field starts a new code instead of being cut off
    const code = otpDigits(digits.length > OTP_LENGTH && value && digits.startsWith(value) ? digits.slice(value.length) : digits);
    setShowError(false);
    onChange(code);
    if (code.length === OTP_LENGTH && code !== value) onComplete?.(code);
  };

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View style={[{ flexDirection: 'row', justifyContent: 'center', gap: 8 }, rowStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const digit = value[i];
          const active = focused && !disabled && i === Math.min(value.length, OTP_LENGTH - 1) && value.length < OTP_LENGTH;
          const borderColor = showError ? colors.danger : active ? colors.brand : digit ? colors.borderStrong : colors.border;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 52,
                height: 60,
                marginLeft: i === OTP_LENGTH / 2 ? 6 : 0,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.md,
                borderWidth: active || showError ? 2 : 1,
                borderColor,
                backgroundColor: showError ? colors.dangerSoft : digit ? colors.surface : colors.surfaceSunken,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {digit ? (
                <Text variant="priceLarge" tabular color={showError ? 'danger' : 'text'}>{digit}</Text>
              ) : active ? (
                <Animated.View style={[{ width: 2, height: 26, borderRadius: 1, backgroundColor: colors.brand }, caretStyle]} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={change}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={`Código de ${OTP_LENGTH} dígitos`}
        accessibilityHint="Escribe o pega el código que te enviamos por correo"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // nearly transparent rather than hidden, so taps, long-press paste and autofill still reach it
        style={[typography.body, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
    </View>
  );
});
