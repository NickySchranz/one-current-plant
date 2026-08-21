import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/ui/theme";

/** The One Current Plant mark: a small pot, one stem, and a single leaf. */
export function Logo({ size = 22 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      {/* pot */}
      <Path d="M6.5 15 H15.5 L14.2 20 H7.8 Z" fill={t.ink} opacity={0.85} />
      {/* stem */}
      <Path
        d="M11 15 C11 11, 10.2 8.5, 11 4.5"
        stroke={t.accent}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      {/* leaf */}
      <Path
        d="M10.8 8.5 Q6.5 8.8 4.8 5.2 Q9.6 4.4 10.8 8.5 Z"
        fill={t.accent}
        opacity={0.85}
      />
    </Svg>
  );
}
