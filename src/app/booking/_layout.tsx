import { Stack } from "expo-router";

import { Colors } from "@/lib/theme/colors";

// The booking wizard is a sibling top-level stack (see PLAN.md/AGENTS.md
// discussion in the approved plan) — not nested inside `(customer)`'s
// Native Tabs group, so it can never be mistaken for an extra tab. The root
// `_layout.tsx` Stack has `headerShown: false` globally; this nested layout
// re-enables a minimal native header just for `/booking/*`, giving every
// step a back button + swipe-back gesture for free instead of hand-rolling
// one per screen.
export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerTintColor: Colors.NAVY,
        headerStyle: { backgroundColor: "#FFFFFF" },
      }}
    />
  );
}
