import { csrfHeader } from "./csrf.js";

/**
 * tests-e2e/helpers/expert-unlock.js — Débloque un Mode Expert via l'API réelle.
 *
 * Depuis la porte d'entrée du Mode Expert (api/lib/expert_unlocks.php), une
 * session `is_expert=1` est refusée en 403 tant que la condition du mode n'est
 * pas remplie côté serveur, et `applyExpertGate()` (js/gameCore.js) redirige
 * `?expert=1` vers le mode normal pour un visiteur non débloqué. Les specs
 * expert-*.spec.js testent le GAMEPLAY Expert, pas ce déblocage — elles doivent
 * donc partir d'un compte déjà débloqué plutôt que de retester la porte.
 *
 * Mêmes seuils que api/lib/expert_unlocks.php::personadle_expert_conditions() —
 * toute divergence ici est à resynchroniser avec ce fichier.
 */
const CONDITIONS = {
  classic: { type: "mode_wins_under_attempts", value: 10 },
  silhouette: { type: "mode_wins_under_attempts", value: 10 },
  emoji: { type: "mode_wins_single_day", value: 10 },
  alloutattack: { type: "mode_consecutive_perfects", value: 15 },
  personae: { type: "mode_consecutive_perfects", value: 15 },
  music: { type: "mode_consecutive_perfects", value: 15 },
};

const aujourdhui = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

/**
 * Enregistre un nouveau compte sur `ctx` et lui fait remplir la condition de
 * déblocage du Mode Expert pour `mode`, en jouant réellement les parties via
 * POST /api/sessions (pas d'écriture SQL directe — l'anti-triche phase 1 ne
 * bloque rien, seule la première partie du jour est comparée au tirage attendu
 * puis journalée, cf. api/sessions.php).
 *
 * @param {import('@playwright/test').APIRequestContext} ctx
 * @param {string} mode
 * @returns {Promise<{ userId: number }>}
 */
export async function registerAndUnlockExpert(ctx, mode) {
  const cond = CONDITIONS[mode];
  if (!cond) throw new Error(`Mode Expert inconnu pour le déblocage E2E : ${mode}`);

  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const res = await ctx.post("/api/auth/register", {
    data: {
      email: `e2e_unlock_${rnd}@test.local`,
      pseudo: `e2eu_${rnd}`.slice(0, 20),
      password: "test1234",
    },
  });
  if (!res.ok()) {
    throw new Error(
      `Échec de l'inscription du compte de déblocage Expert (${mode}) : ${res.status()} — ` +
        `si 429, c'est le rate-limit (attendre ~15 min ou vider rate_limits).`
    );
  }
  const userId = (await res.json()).user.id;

  const today = aujourdhui();
  const headers = await csrfHeader(ctx);
  // mode_consecutive_perfects exige EXACTEMENT 1 essai ; les deux autres types
  // n'exigent qu'un seuil (<= 4 pour mode_wins_under_attempts) — 1 le respecte
  // aussi, autant jouer chaque partie parfaite pour les trois types.
  const attempts = 1;

  for (let i = 0; i < cond.value; i++) {
    const r = await ctx.post("/api/sessions", {
      data: {
        mode,
        played_date: today,
        target_name: `E2E unlock ${mode} #${i}`,
        result: "win",
        attempts,
        time_ms: 3000,
        client_session_id: crypto.randomUUID(),
      },
      headers,
    });
    if (!r.ok()) {
      throw new Error(
        `Échec du déblocage Expert (${mode}), partie ${i + 1}/${cond.value} : ${r.status()} ${await r.text()}`
      );
    }
  }

  return { userId };
}
