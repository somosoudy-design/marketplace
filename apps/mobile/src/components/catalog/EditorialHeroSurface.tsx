import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View } from 'react-native';
import { palette } from '@kora/design-tokens';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

/** A larger, honest product photograph; enlarged text gets its own full-width row. */
export function EditorialHeroSurface({ width, renderPhoto, generalImage, children }: {
  width: number; renderPhoto: (photoWidth: number) => ReactNode; generalImage: boolean; children: ReactNode;
}) {
  const t=useTheme();const {fontScale}=useWindowDimensions();
  const stacked=fontScale>1.3 || width<340;
  const photoWidth=stacked?Math.min(220,width-48):Math.min(280,Math.round((width-24)*0.49));
  return <LinearGradient testID="home-hero-surface" colors={t.scheme==='dark'?[t.colors.surface,palette.violet[900]]:[palette.violet[100],palette.violet[50],palette.violet[200]]}
    start={{x:0,y:0}} end={{x:1,y:1}} style={{borderRadius:18,overflow:'hidden',flexDirection:stacked?'column':'row',alignItems:'stretch'}}>
    <View testID="home-hero-media" style={{width:stacked?'100%':photoWidth,justifyContent:'center',alignItems:'center',paddingVertical:stacked?12:8}}>
      {renderPhoto(photoWidth)}
      {generalImage?<Text testID="home-editorial-general" variant="caption" color="textSecondary" align="center" style={{fontSize:10,lineHeight:14,paddingHorizontal:8,paddingTop:4}}>Imagen general del producto</Text>:null}
    </View>
    <View testID="home-hero-copy" style={{flex:1,minWidth:0,paddingVertical:14,paddingLeft:stacked?14:10,paddingRight:14,gap:6,justifyContent:'center'}}>{children}</View>
  </LinearGradient>;
}
