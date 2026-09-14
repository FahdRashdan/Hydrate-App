// Brand colors sampled from the design/ mockups (Auth-UI-Design.png,
// Name-phone-required.png). Applied via `style={{ color: Colors.NAVY }}`,
// not NativeWind arbitrary-value classes — Tailwind's static class
// extraction needs literal className strings, not dynamic ones, so
// dynamically-referenced brand colors have to go through `style` instead.
// `index.tsx` and `onboarding/profile.tsx` predate this file and
// keep their own local consts (not worth churning working, unrelated
// screens to migrate) — every screen added after this file exists should
// import from here instead of redefining these.
export const Colors = {
  NAVY: "#0B3477",
  TEAL: "#2FB6D4",
  PRIMARY: "#2FB6D4",
  BRAND_BLUE: "#2FB6D4",
  SKY: "#F0F9FD",
  SKY_LIGHT: "#E6F6FB",
  CHARCOAL: "#1F2223",
  LABEL_GRAY: "#6B7280",
  SUBTITLE_GRAY: "#4B5563",
  CARD_BORDER: "rgba(11, 52, 119, 0.12)",
  BORDER_LIGHT: "#E2E8F0",
  AMBER: "#F59E0B",
  AMBER_BG: "#FEF3C7",
  AMBER_TEXT: "#B45309",
  GREEN: "#10B981",
  GREEN_BG: "#DCFCE7",
  GREEN_TEXT: "#15803D",
  RED: "#EF4444",
  RED_BG: "#FEE2E2",
  RED_TEXT: "#B91C1C",
  WHITE: "#FFFFFF",
} as const;
