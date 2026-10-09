import { memo } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';
import { ICONS, type IconName } from './icon-paths';

export type { IconName };

const ALIASES: Record<string, IconName> = { smile: 'face-slightly-smiling', home: 'house', filter: 'funnel', trash: 'trash' };
const ELEMENTS = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline } as const;

/** Resolves any icon name (including ones stored in the database) to a known icon, with a neutral fallback. */
export function resolveIcon(name: string | null | undefined): IconName {
  if (name && name in ICONS) return name as IconName;
  if (name && ALIASES[name]) return ALIASES[name]!;
  return 'tag';
}

interface Props {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

/** Line icons on a 24px grid with a 1.75 stroke: one consistent family across the app. */
export const Icon = memo(function Icon({ name, size = 22, color, strokeWidth = 1.75, fill = 'none' }: Props) {
  const { colors } = useTheme();
  const nodes = ICONS[resolveIcon(name)] as unknown as [keyof typeof ELEMENTS, Record<string, string>][];
  const stroke = color ?? colors.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {nodes.map(([tag, attrs], i) => {
        const El = ELEMENTS[tag] as React.ComponentType<Record<string, unknown>>;
        return El ? <El key={i} {...attrs} /> : null;
      })}
    </Svg>
  );
});
