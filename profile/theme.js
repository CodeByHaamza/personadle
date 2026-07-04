/**
 * profile/theme.js — Thèmes de couleur du profil, partagés entre profile-page.js
 * (ton propre profil, sélecteur de thème) et profile-view.js (profil d'un ami,
 * applique son thème en lecture seule). Les deux fichiers avaient chacun leur
 * copie des mêmes 8 couleurs (le code le disait lui-même : "identiques à
 * profile-page.js").
 */

/** Couleurs par thème — id → { accent, hover, light, rgb }. Pas de "custom" ici : résolu à la volée. */
export const THEME_COLORS = {
  all_out: { accent: "#E63946", hover: "#C1121F", light: "#FF9999", rgb: "230, 57, 70" },
  velvet_room: { accent: "#1B3A8A", hover: "#162E72", light: "#60A5FA", rgb: "27, 58, 138" },
  dark_hour: { accent: "#00B4D8", hover: "#0077B6", light: "#48CAE4", rgb: "0, 180, 216" },
  pink_ribbon: { accent: "#E8739A", hover: "#D0507A", light: "#F9A8D4", rgb: "232, 115, 154" },
  midnight_channel: { accent: "#EAB308", hover: "#CA8A04", light: "#FEF08A", rgb: "234, 179, 8" },
  demon_palace: { accent: "#9333EA", hover: "#7E22CE", light: "#D8B4FE", rgb: "147, 51, 234" },
  eternal_punishment: { accent: "#4F46E5", hover: "#4338CA", light: "#A5B4FC", rgb: "79, 70, 229" },
  golden_labyrinth: { accent: "#F97316", hover: "#EA6C12", light: "#FDBA74", rgb: "249, 115, 22" },
};

/** Convertit un hex en "r, g, b" pour rgba(). */
export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "0, 0, 0";
}

/** Éclaircit ou assombrit une couleur hex d'un delta (-255 → 255). */
export function adjustHex(hex, delta) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + delta));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + delta));
  const b = Math.min(255, Math.max(0, (n & 0xff) + delta));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/**
 * Résout les 4 variables CSS pour un thème donné (ou une couleur custom).
 * Pure — ne touche jamais au DOM. Retourne null si non résolvable.
 * @param {string} themeId
 * @param {string} [customColor] - Couleur hex, uniquement utilisée si themeId === 'custom'
 * @returns {{accent:string, hover:string, light:string, rgb:string}|null}
 */
export function resolveTheme(themeId, customColor) {
  if (themeId === "custom") {
    if (!customColor) return null;
    return {
      accent: customColor,
      hover: adjustHex(customColor, -35),
      light: adjustHex(customColor, 45),
      rgb: hexToRgb(customColor),
    };
  }
  return THEME_COLORS[themeId] || null;
}

/** Applique les 4 variables CSS de thème sur <html>. No-op si vars est null. */
export function applyThemeVars(vars) {
  if (!vars) return;
  const root = document.documentElement;
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--accent-hover", vars.hover);
  root.style.setProperty("--accent-light", vars.light);
  root.style.setProperty("--accent-rgb", vars.rgb);
}
