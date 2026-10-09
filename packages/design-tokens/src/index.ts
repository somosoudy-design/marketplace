/**
 * Kora design tokens. Single source of truth for the native app, the admin/seller web panel and generated demo
 * assets.
 *
 * Direction: "Electric Violet". Violet is the color of action (buttons, selection, links), never a background
 * wash; coral is energy (offers, news, the cart count); deep ink carries prices and text; soft lavender marks
 * what is selected or highlighted. Surfaces stay quiet and slightly cool so product photos lead. One sans family
 * (Plus Jakarta Sans) in a tight hierarchy; no decorative shadows: borders and surfaces build depth, shadows only
 * lift what floats (sheets, sticky bars, floating buttons).
 */

export const palette = {
  violet: { 50: '#F6F2FF', 100: '#EDE6FF', 200: '#DACDFF', 300: '#B9A2FA', 400: '#9374F2', 500: '#6D42E8', 600: '#5B31D2', 700: '#4826AB', 800: '#361C84', 900: '#22125A' },
  ink: { 0: '#FFFFFF', 50: '#F8F7FC', 100: '#F0EEF6', 200: '#E4E1EC', 300: '#CFCBDA', 400: '#A9A4B6', 500: '#8C889A', 600: '#777383', 650: '#6B6779', 700: '#55516A', 800: '#2E2A3D', 900: '#1C1928' },
  coral: { 50: '#FFF1EF', 100: '#FFDCD8', 300: '#FF9B93', 400: '#FF746B', 500: '#F2564C', 600: '#C93A31', 700: '#A12C25' },
  green: { 50: '#E7F6EF', 300: '#5CC79A', 500: '#1F9D6B', 600: '#137A55' },
  amber: { 50: '#FFF5E0', 300: '#F8C25C', 400: '#F5A524', 600: '#9A5B00' },
  sky: { 50: '#EAF1FE', 300: '#8DB4F5', 500: '#2563CC' },
  night: { 600: '#2C2839', 700: '#252131', 800: '#1B1825', 900: '#110F18', 950: '#0B0A10' },
} as const;

/** Photo backdrops: what shows behind (and before) a product photo, by category. Quiet, slightly tinted. */
export const photoTones = {
  sand: { bg: '#F3EFEA', bgDeep: '#E9E2D9', shadow: '#B9A68E', dark: '#2A2622' },
  sage: { bg: '#EAF0EA', bgDeep: '#DCE6DB', shadow: '#8FA58A', dark: '#222A23' },
  blush: { bg: '#F8ECEB', bgDeep: '#F0DCD9', shadow: '#C1968E', dark: '#2D2324' },
  mist: { bg: '#ECF0F6', bgDeep: '#DEE4EE', shadow: '#8E9FB3', dark: '#22262E' },
  clay: { bg: '#F5ECE4', bgDeep: '#ECDDD0', shadow: '#B08C70', dark: '#2B241F' },
  lilac: { bg: '#F1ECFB', bgDeep: '#E5DCF8', shadow: '#9A8CB2', dark: '#262131' },
  night: { bg: '#2A2635', bgDeep: '#211E2A', shadow: '#0B0A10', dark: '#2A2635' },
} as const;
export type PhotoTone = keyof typeof photoTones;

export type ColorScheme = 'light' | 'dark';

export const colors = {
  light: {
    background: palette.ink[50],
    surface: palette.ink[0],
    surfaceSunken: palette.ink[100],
    surfaceRaised: '#FFFFFF',
    border: 'rgba(28, 25, 40, 0.08)',
    borderStrong: 'rgba(28, 25, 40, 0.16)',
    text: palette.ink[900],
    textSecondary: palette.ink[700],
    textMuted: palette.ink[650],
    textInverse: '#FFFFFF',
    brand: palette.violet[500],
    brandPressed: palette.violet[600],
    brandSoft: palette.violet[100],
    onBrand: '#FFFFFF',
    accent: palette.coral[400],
    accentSoft: palette.coral[50],
    onAccent: palette.ink[900],
    danger: palette.coral[600],
    dangerSoft: palette.coral[50],
    success: palette.green[600],
    successSoft: palette.green[50],
    warning: palette.amber[600],
    warningSoft: palette.amber[50],
    info: palette.sky[500],
    infoSoft: palette.sky[50],
    editorial: palette.violet[700],
    editorialSoft: palette.violet[50],
    overlay: 'rgba(28, 25, 40, 0.48)',
    skeleton: '#ECE9F3',
    skeletonHighlight: '#F6F4FA',
    tabBar: 'rgba(255, 255, 255, 0.96)',
    /** Opaque bars pinned over scrolling content (purchase bar, collapsed headers). */
    chrome: '#FFFFFF',
  },
  dark: {
    background: palette.night[900],
    surface: palette.night[800],
    surfaceSunken: palette.night[950],
    surfaceRaised: palette.night[700],
    border: 'rgba(243, 241, 250, 0.09)',
    borderStrong: 'rgba(243, 241, 250, 0.18)',
    text: '#F3F1FA',
    textSecondary: '#C4C0D3',
    textMuted: '#9893AA',
    textInverse: palette.ink[900],
    brand: '#A98CFF',
    brandPressed: '#C2AEFF',
    brandSoft: 'rgba(169, 140, 255, 0.16)',
    onBrand: '#14101F',
    accent: '#FF8A82',
    accentSoft: 'rgba(255, 116, 107, 0.16)',
    onAccent: '#14101F',
    danger: '#FF8A82',
    dangerSoft: 'rgba(255, 116, 107, 0.14)',
    success: palette.green[300],
    successSoft: 'rgba(92, 199, 154, 0.14)',
    warning: palette.amber[300],
    warningSoft: 'rgba(248, 194, 92, 0.14)',
    info: palette.sky[300],
    infoSoft: 'rgba(141, 180, 245, 0.14)',
    editorial: '#C2AEFF',
    editorialSoft: 'rgba(169, 140, 255, 0.14)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: palette.night[700],
    skeletonHighlight: palette.night[600],
    tabBar: 'rgba(27, 24, 37, 0.96)',
    chrome: palette.night[800],
  },
} as const;
export type ColorTokens = { [K in keyof typeof colors.light]: string };

export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Type scale (size / line height / letter spacing). One family; weight and size carry the hierarchy. */
export const typography = {
  displayXL: { fontFamily: fontFamilies.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  displayL: { fontFamily: fontFamilies.extrabold, fontSize: 25, lineHeight: 30, letterSpacing: -0.6 },
  displayM: { fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  title: { fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  body: { fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodySmall: { fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 16, letterSpacing: 0 },
  caption: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: fontFamilies.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  price: { fontFamily: fontFamilies.extrabold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3 },
  priceLarge: { fontFamily: fontFamilies.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  button: { fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
} as const;
export type TypographyVariant = keyof typeof typography;

export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 14: 56, 16: 64 } as const;
export const radii = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

/** Shadows only for what floats above content (sheets, sticky bars, floating buttons), tinted with ink. */
export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  low: { shadowColor: '#1C1928', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  high: { shadowColor: '#1C1928', shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
} as const;

/** Motion: short, physical, purposeful. All durations collapse to 0 with reduced motion. */
export const motion = {
  duration: { instant: 90, fast: 160, base: 240, slow: 360 },
  spring: {
    snappy: { damping: 20, stiffness: 320, mass: 0.8 },
    gentle: { damping: 22, stiffness: 180, mass: 1 },
    sheet: { damping: 26, stiffness: 260, mass: 1 },
  },
  pressScale: 0.97,
} as const;

/** Product imagery: one aspect ratio across the catalog (4:5 portrait). */
export const imagery = { productAspect: 4 / 5, coverAspect: 16 / 9, logoSize: 56 } as const;

export const layout = { gutter: 16, maxContentWidth: 720, tabBarHeight: 58, hitSlop: 10, minTouch: 44 } as const;

/** Availability state presentation (label + tone), shared by app and admin. */
export const availabilityStyles = {
  available: { tone: 'success', label: 'Disponible' },
  on_order: { tone: 'editorial', label: 'Por encargo' },
  in_transit: { tone: 'info', label: 'En camino' },
  reservable: { tone: 'warning', label: 'Reservable' },
  sold_out: { tone: 'muted', label: 'Agotado' },
  unavailable: { tone: 'muted', label: 'No disponible' },
} as const;

/** Store color choices; the keys are stored per store, so they keep their names when the palette changes. */
export const storeAccents = {
  jade: '#12806A', amber: '#D98A12', coral: palette.coral[500],
  plum: palette.violet[600], ink: palette.ink[800], sky: palette.sky[500],
} as const;
