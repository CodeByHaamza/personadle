/**
 * profile/leaderboard/rank_delta.js — ▲▼ depuis ta dernière visite (2.4, lot 15).
 *
 * Le serveur ne garde aucun rang passé (leaderboard_cache est recalculé chaque
 * heure, sans historique) : l'évolution se mesure donc dans le navigateur, contre
 * les rangs que CE joueur a vus la dernière fois sur la même vue — même dimension,
 * mode, période, métrique, filtre amis, et même jour / semaine / mois pour les
 * périodes bornées (un classement du jour repart de zéro chaque matin).
 *
 * La référence vit 12 h : elle n'est remplacée qu'une fois périmée, sinon un simple
 * rechargement effacerait les flèches qu'on vient de voir.
 */

import { parisDateKey } from "../../js/gameCore.js";

export const RANK_BASELINE_PREFIX = "lbRanks:";
export const BASELINE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_STORED = 120;

/** Début de la période affichée, pour qu'un classement borné ne se compare qu'à lui-même. */
export function periodInstance(period, today = parisDateKey()) {
  if (period === "day") return today;
  if (period === "month") return today.slice(0, 7);
  if (period === "week") {
    const d = new Date(`${today}T12:00:00Z`);
    const back = (d.getUTCDay() + 6) % 7; // lundi = 0
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  }
  return "ever";
}

/** Clé de la vue (une référence par vue). */
export function viewKey({ expert, mode, period, metric, friendsOnly }, today) {
  return [
    RANK_BASELINE_PREFIX + (expert ? "expert" : "normal"),
    mode,
    period,
    periodInstance(period, today),
    metric,
    friendsOnly ? "friends" : "all",
  ].join("|");
}

function _read(storage, key) {
  try {
    const v = JSON.parse(storage.getItem(key) || "null");
    return v && typeof v.at === "number" && v.ranks && typeof v.ranks === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Écart de rang d'un joueur : positif = il a monté. null = rien à comparer
 * (pas de référence, ou joueur absent de la référence).
 */
export function rankDelta(baseline, userId, rank) {
  const before = baseline?.ranks?.[userId];
  if (!Number.isInteger(before) || !Number.isInteger(rank)) return null;
  return before - rank;
}

/**
 * Lit la référence de la vue, puis la remplace par les rangs affichés SI elle est
 * absente ou périmée. Renvoie la référence à utiliser pour les flèches.
 *
 * @param {string} key
 * @param {{user_id: number, rank: number}[]} rows  lignes affichées (+ « ma place »)
 * @param {{storage?: Storage, now?: number, write?: boolean}} [opts]
 */
export function takeBaseline(
  key,
  rows,
  { storage = localStorage, now = Date.now(), write = true } = {}
) {
  const baseline = _read(storage, key);
  // `write: false` sur les pages 2+ : une page partielle ne doit pas devenir la
  // référence de toute la vue.
  if (write && (!baseline || now - baseline.at >= BASELINE_TTL_MS)) {
    const ranks = {};
    for (const r of rows.slice(0, MAX_STORED)) {
      if (Number.isInteger(r?.user_id) && Number.isInteger(r?.rank)) ranks[r.user_id] = r.rank;
    }
    try {
      storage.setItem(key, JSON.stringify({ at: now, ranks }));
    } catch {
      /* stockage plein : pas de flèches la prochaine fois, rien de cassé */
    }
  }
  return baseline && now - baseline.at < BASELINE_TTL_MS ? baseline : null;
}

/** Pastille HTML d'un écart (« ▲2 », « ▼1 »), vide sans changement. */
export function deltaBadge(delta, t = (k, f) => f) {
  if (!delta) return "";
  const up = delta > 0;
  const n = Math.abs(delta);
  const label = up
    ? t("leaderboard.rank_up", `Up ${n} since your last visit`, { n })
    : t("leaderboard.rank_down", `Down ${n} since your last visit`, { n });
  return `<span class="lb-delta lb-delta--${up ? "up" : "down"}" title="${label}" aria-label="${label}">${
    up ? "▲" : "▼"
  }${n}</span>`;
}
