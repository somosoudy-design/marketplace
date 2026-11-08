import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { palette } from '@kora/design-tokens';

/** A continuous studio surface; the photograph, product identity and full title stay intact. */
export function EditorialHeroSurface({ width, renderPhoto, children }: {
  width: number; renderPhoto: (photoWidth: number) => ReactNode; children: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const cardWidth = Math.max(0, width - 24);
  const mediaWidth = stacked ? cardWidth : Math.min(300, Math.round(cardWidth * 0.46));
  const photoWidth = stacked ? Math.min(220, cardWidth - 32) : mediaWidth;
  // Blend only onto a nearly white studio stage, never onto the dark app background.
  const canBlend = Platform.OS === 'web' || (Platform.OS === 'android' && Number(Platform.Version) >= 29);
  const paper = canBlend ? '#FCFAFF' : palette.ink[0];
  const ratio = stacked ? 0.5 : mediaWidth / cardWidth;
  return <View testID="home-hero-surface" collapsable={false} style={{ borderRadius: 20, overflow: 'hidden', isolation: 'isolate', flexDirection: stacked ? 'column' : 'row', alignItems: 'stretch', backgroundColor: paper }}>
    <LinearGradient pointerEvents="none" colors={[paper, paper, palette.violet[50], palette.violet[200]]}
      locations={[0, ratio, Math.min(0.75, ratio + 0.14), 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    <View testID="home-hero-media" style={{ width: mediaWidth, backgroundColor: stacked ? paper : undefined, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
      <View collapsable={false} style={{ width: photoWidth, height: photoWidth + 28, backgroundColor: paper }}>
        <LinearGradient pointerEvents="none" colors={[palette.violet[300], palette.violet[200]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', bottom: 0, left: -8, width: photoWidth + 16, height: 24, transform: [{ skewY: '5deg' }] }} />
        <LinearGradient pointerEvents="none" colors={[palette.violet[100], palette.violet[200]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', bottom: 22, left: -8, width: photoWidth + 16, height: 12, transform: [{ skewY: '5deg' }] }} />
        <View collapsable={false} style={canBlend ? { mixBlendMode: 'multiply' } : undefined}>{renderPhoto(photoWidth)}</View>
      </View>
    </View>
    {stacked ? <LinearGradient pointerEvents="none" colors={[paper, 'rgba(252,250,255,0)']} style={{ height: 18 }} /> : null}
    <View testID="home-hero-copy" style={{ flex: 1, minWidth: 0, paddingVertical: 16, paddingLeft: stacked ? 16 : 12, paddingRight: 16, gap: 7, justifyContent: 'center' }}>{children}</View>
  </View>;
}
