/**
 * Landing Page Design Tokens
 * Centralized, reusable design system
 */

import { DesignTokens } from "./landing.types";

export const tokens: DesignTokens = {
  color: {
    bg: "#07080A",
    surface: "#0D0F12",
    surfaceElevated: "#111418",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.12)",
    text: "#F0F2F5",
    textMuted: "#6B7280",
    textSubtle: "#374151",
    accent: "#22C55E",
    accentDim: "rgba(34,197,94,0.12)",
    accentBorder: "rgba(34,197,94,0.25)",
    warning: "#F59E0B",
    danger: "#EF4444",
    blue: "#3B82F6",
    gold: "#D97706",
  },
};

export const mediaQueryBreakpoints = {
  mobile: "max-width: 480px",
  tablet: "max-width: 768px",
  desktop: "min-width: 769px",
};

export const animationDurations = {
  fast: "0.2s",
  normal: "0.5s",
  slow: "0.7s",
  extended: "1s",
};
