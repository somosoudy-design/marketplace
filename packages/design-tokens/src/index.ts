/**
 * Kora design tokens (provisional brand). Single source of truth for the native app,
 * the admin/seller web panel and generated demo assets.
 *
 * Direction: "Arena y Jade" — warm sand surfaces, a deep jade brand color, amber for
 * moments of delight, coral for urgency. Editorial serif for display, humanist sans for UI.
 * Not black/white minimalism, not clinical pale.
 */

export const palette = {
  jade: { 50: '#E8F4F1', 100: '#CBE7E0', 200: '#97CFC2', 300: '#5FB3A1', 400: '#2F9580', 500: '#137A67', 600: '#0E5E54', 700: '#0B4A43', 800: '#093A35', 900: '#062824' },
  amber: { 50: '#FEF6E9', 100: '#FDE8C6', 200: '#FAD08F', 300: '#F6B85A', 400: '#F2A541', 500: '#DB8A22', 600: '#B56D16', 700: '#8A5212' },
  coral: { 50: '#FDEDEA', 100: '#F9D3CC', 300: '#EF8D7C', 500: '#E0563F', 600: '#C2422D', 700: '#9A3323' },
  plum: { 50: '#F3EEF6', 100: '#E4DAEC', 300: '#A98BBE', 500: '#6E4A86', 700: '#4B2F5E' },
  sky: { 50: '#EAF2FA', 300: '#8DB5DE', 500: '#3C7DBF', 700: '#24578C' },
  sand: { 0: '#FFFDF9', 50: '#FBF7F1', 100: '#F6F0E7', 200: '#EEE5D8', 300: '#E2D5C3', 400: '#CDBBA4', 500: '#A8957D', 600: '#7D6C58', 700: '#5A4D3F', 800: '#3A322A', 900: '#211D19' },
  night: { 600: '#2E3338', 700: '#23272B', 800: '#1A1D20', 900: '#121416' },
} as const;

/** Photo backdrops: every product image sits on the tone of its category. */
export const photoTones = {
  sand: { bg: '#EFE5D6', bgDeep: '#E2D3BE', shadow: '#B9A285', dark: '#3A332B' },
  sage: { bg: '#DDE6DA', bgDeep: '#C9D7C4', shadow: '#8FA58A', dark: '#2B342B' },
  blush: { bg: '#F2DFD9', bgDeep: '#E8CBC2', shadow: '#BE968B', dark: '#3A2C29' },
  mist: { bg: '#DFE6EE', bgDeep: '#CAD5E2', shadow: '#8E9FB3', dark: '#283039' },
  clay: { bg: '#EBD7C6', bgDeep: '#DEC2AB', shadow: '#B08C70', dark: '#3A2E25' },
  lilac: { bg: '#E6E0EF', bgDeep: '#D6CCE6', shadow: '#9A8CB2', dark: '#2F2A38' },
  night: { bg: '#2B3036', bgDeep: '#22262B', shadow: '#0E1012', dark: '#2B3036' },
} as const;
export type PhotoTone = keyof typeof photoTones;

export type ColorScheme = 'light' | 'dark';

export const colors = {
  light: {
    background: palette.sand[100],
    surface: palette.sand[0],
    surfaceSunken: palette.sand[200],
    surfaceRaised: '#FFFFFF',
    border: 'rgba(58, 50, 42, 0.12)',
    borderStrong: 'rgba(58, 50, 42, 0.24)',
    text: palette.sand[900],
    textSecondary: palette.sand[700],
    textMuted: palette.sand[600],
    textInverse: palette.sand[0],
    brand: palette.jade[600],
    brandPressed: palette.jade[700],
    brandSoft: palette.jade[50],
    onBrand: '#FFFFFF',
    accent: palette.amber[400],
    accentSoft: palette.amber[50],
    onAccent: palette.sand[900],
    danger: palette.coral[600],
    dangerSoft: palette.coral[50],
    success: palette.jade[500],
    successSoft: palette.jade[50],
    warning: palette.amber[600],
    warningSoft: palette.amber[50],
    info: palette.sky[500],
    infoSoft: palette.sky[50],
    editorial: palette.plum[500],
    editorialSoft: palette.plum[50],
    overlay: 'rgba(33, 29, 25, 0.48)',
    skeleton: palette.sand[200],
    skeletonHighlight: palette.sand[100],
    tabBar: 'rgba(255, 253, 249, 0.94)',
  },
  dark: {
    background: palette.night[900],
    surface: palette.night[800],
    surfaceSunken: '#0D0F10',
    surfaceRaised: palette.night[700],
    border: 'rgba(246, 240, 231, 0.10)',
    borderStrong: 'rgba(246, 240, 231, 0.22)',
    text: palette.sand[100],
    textSecondary: palette.sand[300],
    textMuted: palette.sand[400],
    textInverse: palette.sand[900],
    brand: palette.jade[300],
    brandPressed: palette.jade[200],
    brandSoft: 'rgba(95, 179, 161, 0.14)',
    onBrand: palette.jade[900],
    accent: palette.amber[300],
    accentSoft: 'rgba(246, 184, 90, 0.14)',
    onAccent: palette.sand[900],
    danger: palette.coral[300],
    dangerSoft: 'rgba(239, 141, 124, 0.14)',
    success: palette.jade[300],
    successSoft: 'rgba(95, 179, 161, 0.14)',
    warning: palette.amber[300],
    warningSoft: 'rgba(246, 184, 90, 0.14)',
    info: palette.sky[300],
    infoSoft: 'rgba(141, 181, 222, 0.14)',
    editorial: palette.plum[300],
    editorialSoft: 'rgba(169, 139, 190, 0.16)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: palette.night[700],
    skeletonHighlight: palette.night[600],
    tabBar: 'rgba(26, 29, 32, 0.94)',
  },
} as const;
export type ColorTokens = { [K in keyof typeof colors.light]: string };

export const fontFamilies = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'Manrope_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtraBold: 'Manrope_800ExtraBold',
} as const;

/** Type scale (size / line height / letter spacing). Display uses the serif; everything else Manrope. */
export const typography = {
  displayXL: { fontFamily: fontFamilies.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  displayL: { fontFamily: fontFamilies.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  displayM: { fontFamily: fontFamilies.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.2 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subtitle: { fontFamily: fontFamilies.bodySemibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySmall: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  label: { fontFamily: fontFamilies.bodySemibold, fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
  caption: { fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: { fontFamily: fontFamilies.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  price: { fontFamily: fontFamilies.bodyExtraBold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3 },
  priceLarge: { fontFamily: fontFamilies.bodyExtraBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  button: { fontFamily: fontFamilies.bodyBold, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
} as const;
export type TypographyVariant = keyof typeof typography;

export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 14: 56, 16: 64 } as const;
export const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  low: { shadowColor: '#3B2A1A', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  high: { shadowColor: '#3B2A1A', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
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

export const storeAccents = {
  jade: palette.jade[600], amber: palette.amber[500], coral: palette.coral[500],
  plum: palette.plum[500], ink: palette.sand[800], sky: palette.sky[500],
} as const;
