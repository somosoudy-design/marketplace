import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors as colorTokens,
  elevation,
  imagery,
  layout,
  motion,
  photoTones,
  radii,
  space,
  typography,
  type ColorTokens,
  type PhotoTone,
} from '@kora/design-tokens';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type SchemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  typography: typeof typography;
  space: typeof space;
  radii: typeof radii;
  elevation: typeof elevation;
  motion: typeof motion;
  imagery: typeof imagery;
  layout: typeof layout;
  tone: (t: string | null | undefined) => { bg: string; bgDeep: string; shadow: string; dark: string };
  preference: SchemePreference;
  setPreference: (p: SchemePreference) => void;
}

const KEY = 'kora.theme';
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<SchemePreference>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v === 'light' || v === 'dark' || v === 'system' ? setPref(v) : undefined)
      .catch(() => undefined);
  }, []);
  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: colorTokens[scheme],
      typography,
      space,
      radii,
      elevation,
      motion,
      imagery,
      layout,
      tone: (t) => {
        const base = photoTones[(t as PhotoTone) in photoTones ? (t as PhotoTone) : 'sand'];
        // in dark mode product backdrops get a deeper, quieter variant so photos do not glare
        return scheme === 'dark' ? { ...base, bg: base.dark, bgDeep: base.dark } : base;
      },
      preference,
      setPreference: (p) => {
        setPref(p);
        AsyncStorage.setItem(KEY, p).catch(() => undefined);
      },
    }),
    [scheme, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
