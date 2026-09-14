import { Platform, View } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

type AppIconProps = {
  name: SFSymbol;
  size?: number;
  color?: string;
};

export function AppIcon({ name, size = 16, color = "#6B7280" }: AppIconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={color}
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback for non-iOS platforms: a subtle dot/accent
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: Math.max(4, size * 0.4),
          height: Math.max(4, size * 0.4),
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
