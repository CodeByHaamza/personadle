/**
 * admin/catalogs.js — Catalogues badges/wallpapers/titres (référentiels complets,
 * indépendants de l'utilisateur sélectionné) utilisés par les onglets de détail
 * utilisateur pour afficher les cases à cocher débloqué/verrouillé.
 */

import { api } from "./admin-api.js";

export let badgesCatalog = [];
export let wallpapersCatalog = [];
export let titlesCatalog = [];

export async function loadBadgesCatalog() {
  try {
    const data = await api.get("/api/badges");
    // /api/badges returns a raw array (no wrapper key)
    const raw = Array.isArray(data) ? data : data.badges || [];
    // Normalize field: API returns `name`, admin UI expects `name_en`
    badgesCatalog = raw.map((b) => ({ ...b, name_en: b.name_en || b.name || b.slug }));
  } catch (e) {
    console.error("[Admin] badges catalog failed", e);
  }
}

export async function loadWallpapersCatalog() {
  try {
    const data = await api.get("/api/wallpapers");
    // /api/wallpapers returns a raw array (no wrapper key)
    wallpapersCatalog = Array.isArray(data) ? data : data.wallpapers || [];
  } catch (e) {
    console.error("[Admin] wallpapers catalog failed", e);
  }
}

export async function loadTitlesCatalog() {
  try {
    const data = await api.get("/api/titles");
    // /api/titles returns a raw array (no wrapper key); field is `name` not `name_en`
    const raw = Array.isArray(data) ? data : data.titles || [];
    titlesCatalog = raw.map((t) => ({ ...t, name_en: t.name_en || t.name || t.slug }));
  } catch (e) {
    console.error("[Admin] titles catalog failed", e);
  }
}
