// ═══════════════════════════════════════════════════════════════════════════
// PALETA "CLARO CON PERSONALIDAD"
// ═══════════════════════════════════════════════════════════════════════════
export const COLORS = {
  bg: "#F6F1E8",              // cream profundo, más papel
  bgAtmos: "radial-gradient(1100px 700px at 18% -8%, #EAF5F2 0%, transparent 60%), radial-gradient(900px 600px at 92% 110%, #F2EAD6 0%, transparent 55%)",
  card: "#FFFFFF",
  cardBorder: "#E5DECF",      // piedra cálida
  cardShadow: "0 1px 0 rgba(30, 41, 59, 0.02), 0 12px 28px -16px rgba(20, 30, 45, 0.12)",
  cardShadowHover: "0 1px 0 rgba(30, 41, 59, 0.02), 0 22px 40px -18px rgba(13, 60, 56, 0.18)",

  ink: "#0F1B1A",             // tinta editorial casi negra con verde
  accent: "#0D7A72",          // teal médico, más profundo
  accentDim: "#D9F0EC",       // teal muy claro, suavizado
  accentDark: "#0B423E",
  accentSoft: "#88B5AF",

  secondary: "#9B3B0E",       // terracota más editorial
  secondaryDim: "#FCE6D2",

  green: "#15803D",
  greenBg: "#DCFCE7",
  yellow: "#B45309",
  yellowBg: "#FEF3C7",
  red: "#B91C1C",
  redBg: "#FEE2E2",
  purple: "#6D28D9",
  purpleBg: "#EDE9FE",
  blue: "#1D4ED8",
  blueBg: "#DBEAFE",

  text: "#1B2A2A",
  textDim: "#475569",
  textMuted: "#8C8475",

  inputBg: "#FBF8F2",
  inputBorder: "#D9D2BF",
  inputFocus: "#0D7A72",
  inputHover: "#F0EAD9",

  rule: "#E5DECF",
};
export const FONT_SERIF = "'Fraunces', 'Georgia', serif";
export const FONT_SANS = "'DM Sans', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

export const MOMENTOS = {
  preoperatorio:  { label: "Preoperatorio",  icon: "🔵", color: COLORS.blue,  bg: COLORS.blueBg,  short: "Pre-op" },
  postoperatorio: { label: "Postoperatorio", icon: "🟢", color: COLORS.green, bg: COLORS.greenBg, short: "Post-op" }
};
