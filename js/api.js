/**
 * js/api.js — Couche d'abstraction pour tous les appels vers le backend PersonaDLE.
 *
 * Utilisation :
 *   import { api } from '../js/api.js';
 *   await api.auth.login({ email, password });
 *   await api.stats.postSession(session);
 *
 * Architecture :
 *   - Toutes les requêtes passent par apiCall() qui gère les headers, les erreurs
 *     HTTP et la désérialisation JSON.
 *   - L'auth utilise des sessions PHP + cookies httpOnly — aucun token à gérer manuellement.
 *   - En dev : BASE_URL = 'http://localhost:8000/api'
 *   - En prod : BASE_URL = 'https://personadle.net/api'
 *
 * Statut v2.0 : backend PHP opérationnel en local (Apache + MySQL via setup.sh).
 * Déploiement Hostinger à venir — les appels vers personadle.net échoueront jusqu'à la mise en prod.
 */

// ─────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────

// Local Apache : projet servi depuis /personadle/ (symlink via setup.sh)
// Docker       : projet servi depuis / (DocumentRoot = /var/www/html)
// Prod         : Hostinger, projet à la racine du domaine
// → On détecte si le pathname commence par /personadle/ pour le préfixer.
const _pathPrefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
const BASE_URL =
  window.location.hostname === "personadle.net"
    ? "https://personadle.net/api"
    : `${window.location.protocol}//${window.location.host}${_pathPrefix}/api`;

// ─────────────────────────────────────────────────────────
// ERREUR API
// ─────────────────────────────────────────────────────────

export class ApiError extends Error {
  /**
   * @param {number} status  - HTTP status code
   * @param {string} message - Error message from server or fallback
   * @param {*}      [data]  - Raw response body
   */
  constructor(status, message, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ─────────────────────────────────────────────────────────
// WRAPPER FETCH
// ─────────────────────────────────────────────────────────

/**
 * Lit le token CSRF depuis le cookie `csrf_token` (posé par api/bootstrap.php,
 * lisible par JS — pattern double-submit). Renvoyé dans le header X-CSRF-Token
 * sur toute requête mutante ; vérifié côté serveur par requireAuth().
 * @returns {string}
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Effectue un appel vers l'API PersonaDLE.
 * - Ajoute automatiquement les headers JSON et les credentials (cookies session).
 * - Lance une ApiError si le status HTTP >= 400.
 *
 * @param {string} endpoint  - Chemin relatif ex : '/auth/login'
 * @param {RequestInit} [opts] - Options fetch (method, body, headers…)
 * @returns {Promise<any>}   - Corps JSON de la réponse
 * @throws {ApiError}        - En cas d'erreur HTTP ou réseau
 */
async function apiCall(endpoint, opts = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    credentials: "include", // envoie les cookies de session PHP
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": getCsrfToken(),
      ...opts.headers,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Réponse vide ou non-JSON (ex: 204 No Content)
  }

  if (!response.ok) {
    const msg = body?.message || body?.error || `HTTP ${response.status}`;
    throw new ApiError(response.status, msg, body);
  }

  return body;
}

/**
 * Shortcut pour un appel POST avec corps JSON.
 * @param {string} endpoint
 * @param {object} data
 */
function post(endpoint, data) {
  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Shortcut pour un appel GET.
 * @param {string} endpoint
 */
function get(endpoint) {
  return apiCall(endpoint, { method: "GET" });
}

// ─────────────────────────────────────────────────────────
// ENDPOINTS ORGANISÉS PAR DOMAINE
// ─────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────
  auth: {
    /**
     * Crée un compte.
     * @param {{ email: string, pseudo: string, password: string, lang?: string }} data
     */
    register: (data) => post("/auth/register", data),

    /**
     * Connecte l'utilisateur (session PHP httpOnly).
     * @param {{ email: string, password: string }} data
     */
    login: (data) => post("/auth/login", data),

    /** Déconnecte l'utilisateur (détruit la session serveur). */
    logout: () => post("/auth/logout", {}),

    /**
     * Retourne le profil de l'utilisateur connecté, ou null si non connecté.
     * À appeler au chargement de page pour restaurer l'état de connexion.
     */
    me: () => get("/auth/me"),

    /** Demande un lien de réinitialisation de mot de passe (envoyé par email). */
    requestReset: (data) => post("/auth/request-reset", data),

    /** Applique un nouveau mot de passe à partir du token reçu par email. */
    resetPassword: (data) => post("/auth/reset-password", data),
  },

  // ── Utilisateur & profil ──────────────────────────────
  user: {
    /**
     * Récupère le profil complet d'un utilisateur.
     * @param {number} userId
     */
    get: (userId) => get(`/user/${userId}`),

    /**
     * État de déblocage des 6 Modes Expert pour l'utilisateur connecté.
     * @returns {Promise<{expert_status: Record<string, {unlocked: boolean, condition_type: string, required: number, current: number}>}>}
     */
    expertStatus: () => get("/user/expert-status"),

    /**
     * Met à jour le profil (avatar, pseudo, thème, wallpaper…).
     * @param {number} userId
     * @param {object} data
     */
    update: (userId, data) =>
      apiCall(`/user/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    /**
     * Migre le profil localStorage vers le compte cloud (appelé une seule fois au register).
     * @param {{ profile: object|null, pendingSessions: object[] }} payload
     */
    migrate: (payload) => post("/user/migrate", payload),

    /**
     * Supprime le compte (soft delete RGPD — hard delete différé J+30).
     * @param {number} userId
     */
    delete: (userId) => apiCall(`/user/${userId}`, { method: "DELETE" }),

    /**
     * Compares stats between the logged-in user and a friend.
     * Handles 72h cooldown per pair and awards Social Link XP.
     * @param {number} friendId
     * @returns {Promise<{ me, friend, on_cooldown, cooldown_until, xp_gained }>}
     */
    compare: (friendId) => get(`/user/compare?friend_id=${friendId}`),
  },

  // ── Statistiques & sessions de jeu ───────────────────
  stats: {
    /**
     * Récupère les stats globales d'un utilisateur.
     * @param {number} userId
     */
    get: (userId) => get(`/user/${userId}/stats`),

    /**
     * Enregistre une session de jeu terminée côté serveur.
     * @param {object} session - Objet buildGameSession()
     */
    postSession: (session) => post("/sessions", session),

    /**
     * Synchronise les sessions en attente stockées dans localStorage.
     * Mutex _syncLock : une seule exécution simultanée (évite la race condition
     * entre gameCore.savePendingSession, auth.initAuth et cloud-sync.pullProfileFromCloud).
     */
    syncPending: async () => {
      if (api.stats._syncLock) return;
      api.stats._syncLock = true;
      const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
      if (!pending.length) { api.stats._syncLock = false; return; }

      // Normalize legacy mode names stored before the server enum was finalised
      const _modeAlias = { shadow: "silhouette", classic: "classic" };
      const normalize = (s) => {
        const m = (s.mode ?? "").toLowerCase();
        return { ...s, mode: _modeAlias[m] ?? m };
      };

      // Clé d'idempotence rétro-active : les sessions mises en file AVANT la
      // migration 032 n'en ont pas, et l'unique key par jour qui les protégeait
      // accidentellement du double-insert n'existe plus. On en pose une, et on la
      // PERSISTE avant d'émettre : régénérée à chaque tentative, elle ne
      // protégerait de rien entre deux passages.
      let seeded = false;
      for (const raw of pending) {
        if (!raw.client_session_id) {
          // Hexa + tirets uniquement : le format attendu par api/sessions.php.
          raw.client_session_id = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
          seeded = true;
        }
      }
      if (seeded) localStorage.setItem("pendingSessions", JSON.stringify(pending));

      // Plafond par passage. Le rate limit de POST /api/sessions est de 90 requêtes
      // par 15 min (api/sessions.php), PARTAGÉ avec les parties en cours. Vider une
      // file de 60 d'un coup consommait donc presque tout le quota, et les parties
      // suivantes du joueur se faisaient refuser en 429 — puis remettre en file, ce
      // qui grossissait le retard. Un joueur avec du retard n'enregistrait plus
      // qu'UNE partie par fenêtre de 15 min : celle envoyée avant le rattrapage.
      // Vécu en prod le 2026-09-02.
      //
      // DIMENSIONNEMENT — l'arithmétique compte ici, une valeur « qui semble
      // raisonnable » ne suffit pas :
      //
      //   coût d'une partie terminée = 1 (la partie elle-même) + BATCH (le rattrapage)
      //   parties possibles par fenêtre = 90 / (1 + BATCH)
      //
      //     BATCH = 20 →  4 parties / 15 min   ← starve un joueur normal
      //     BATCH = 5  → 15 parties / 15 min
      //     BATCH = 3  → 22 parties / 15 min
      //
      // Un joueur qui enchaîne (une partie par minute) en fait ~15 par fenêtre.
      // BATCH = 5 le couvre exactement ; on s'y tient plutôt que de descendre à 3,
      // qui résorberait le retard presque deux fois plus lentement pour une marge
      // dont on n'a pas besoin. Le rattrapage doit rester DERRIÈRE le jeu en
      // priorité : mieux vaut résorber lentement que réintroduire des 429.
      const BATCH = 5;
      const batch = pending.slice(0, BATCH);
      const deferred = pending.slice(BATCH);

      const remaining = [];
      for (let i = 0; i < batch.length; i++) {
        const raw = batch[i];
        const session = normalize(raw);
        try {
          await api.stats.postSession(session);
        } catch (e) {
          if (e?.status === 409) continue; // already recorded server-side, discard
          if (e?.status === 400) continue; // permanently invalid data — discard silently

          remaining.push(raw); // network/server error — keep for later

          // 429 (rate limit) ou 5xx : le serveur demande d'ARRÊTER, pas de
          // réessayer avec l'élément suivant. Poursuivre la boucle relançait une
          // requête immédiatement, qui re-déclenchait un 429, et ainsi de suite
          // jusqu'au bout de la file — puis tout était remis en file et rejoué au
          // chargement suivant. Une file un peu grosse suffisait à s'y enfermer
          // définitivement, en noyant la console et sans qu'aucune session ne
          // passe. Vécu en prod le 2026-09-02.
          //
          // On garde donc le reste SANS l'essayer : la file est conservée intacte
          // pour le prochain passage, quand la fenêtre de limitation sera écoulée.
          if (e?.status === 429 || e?.status >= 500) {
            remaining.push(...batch.slice(i + 1));
            console.warn(
              `⚠️ Sync interrompue (${e.status}) — ${remaining.length} session(s) gardées pour plus tard`
            );
            break;
          }

          console.warn("⚠️ Session sync failed:", e.message);
        }
      }
      localStorage.setItem("pendingSessions", JSON.stringify([...remaining, ...deferred]));
      api.stats._syncLock = false;
    },
    _syncLock: false,
  },

  // ── Daily target ──────────────────────────────────────
  dailyTarget: {
    /**
     * Récupère (ou génère lazily) la cible du jour pour un mode et un utilisateur.
     * @param {string} mode   - 'Classic' | 'Emoji' | 'Silhouette' | 'AllOutAttack' | 'Personae' | 'Music'
     * @param {number} userId
     */
    get: (mode, userId) => get(`/daily/${mode}/${userId}`),
  },

  // ── Profil public ─────────────────────────────────────
  publicProfile: {
    /**
     * Récupère le profil public d'un joueur par friend_code, pseudo ou id.
     * @param {{ code?: string, pseudo?: string, id?: string|number }} params
     */
    get: ({ code, pseudo, id }) => {
      const q = code
        ? `code=${encodeURIComponent(code)}`
        : id
          ? `id=${encodeURIComponent(id)}`
          : `pseudo=${encodeURIComponent(pseudo)}`;
      return get(`/user/public?${q}`);
    },

    /**
     * Recherche des joueurs par pseudo (LIKE) ou friend_code (exact).
     * @param {string} query - Texte de recherche (min 2 caractères)
     */
    search: (query) => get(`/user/search?q=${encodeURIComponent(query)}`),

    /**
     * Liste tous les joueurs (pour la page Browse Players / Friends).
     * Si connecté, inclut le statut de friendship pour chaque joueur.
     * @param {{ q?: string, limit?: number, offset?: number }} params
     */
    list: ({ q = "", limit = 30, offset = 0 } = {}) =>
      get(`/user/list?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`),
  },

  // ── Stats communautaires post-partie ─────────────────
  communityStats: {
    /**
     * Récupère le % de joueurs ayant trouvé la cible du jour dans un mode donné.
     * @param {{ mode: string, date: string, target: string }} params
     *   mode   : identifiant lowercase du mode (ex: 'classic', 'music')
     *   date   : date YYYY-MM-DD (Paris time)
     *   target : nom exact du personnage/musique cible
     */
    get: ({ mode, date, target }) =>
      get(
        `/community-stats?mode=${encodeURIComponent(mode)}&date=${encodeURIComponent(date)}&target=${encodeURIComponent(target)}`
      ),
  },

  // ── Leaderboard ───────────────────────────────────────
  leaderboard: {
    /**
     * Récupère un classement.
     * @param {{ mode?, period?, metric?, limit?, offset? }} params
     *   mode   : 'all' | 'classic' | 'emoji' | 'silhouette' | 'alloutattack' | 'personae' | 'music'
     *   period : 'day' | 'week' | 'month' | 'ever'
     *   metric : 'wins' | 'winrate' | 'streak' | 'perfect' | 'games'
     */
    get: ({
      mode = "all",
      period = "ever",
      metric = "wins",
      limit = 50,
      offset = 0,
      friends_only = 0,
    } = {}) =>
      get(
        `/leaderboard/?mode=${mode}&period=${period}&metric=${metric}&limit=${limit}&offset=${offset}&friends_only=${friends_only}`
      ),
  },

  // ── Amis ──────────────────────────────────────────────
  friends: {
    /**
     * Récupère la liste d'amis + demandes en attente de l'utilisateur connecté.
     *
     * @param {{expert_mode?: string}} [opts] `expert_mode` ajoute `expert_unlocked`
     *   à chaque ami — utilisé par le sélecteur d'un défi Expert, qui ne doit
     *   proposer que des amis capables de le recevoir. Coûteux côté serveur
     *   (~2 requêtes par ami) : à ne demander que lorsque c'est nécessaire.
     */
    list: (opts = {}) => {
      const qs = opts.expert_mode
        ? `?expert_mode=${encodeURIComponent(opts.expert_mode)}`
        : "";
      return get(`/friends${qs}`);
    },

    /**
     * Envoie une demande d'ami par friend_code.
     * @param {string} friendCode - Code de 8 caractères
     */
    request: (friendCode) => post("/friends/", { friend_code: friendCode }),

    /**
     * Accepte ou refuse une demande reçue.
     * @param {number} friendshipId
     * @param {'accept'|'decline'} action
     */
    respond: (friendshipId, action) =>
      apiCall(`/friends/${friendshipId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),

    /**
     * Supprime un ami ou retire une demande envoyée.
     * @param {number} friendshipId
     */
    remove: (friendshipId) => apiCall(`/friends/${friendshipId}`, { method: "DELETE" }),
  },

  // ── Notifications ─────────────────────────────────────
  notifications: {
    /**
     * Retourne le nombre de demandes d'ami non vues.
     * @returns {Promise<{ friend_requests: number }>}
     */
    get: () => get("/notifications"),

    /**
     * Marque toutes les demandes en attente comme vues.
     * Slash final obligatoire : PATCH sans lui se fait dégrader en GET par la
     * redirection 301 d'Apache sur /api/notifications (dossier) — cf. /friends/.
     */
    markSeen: () => apiCall("/notifications/", { method: "PATCH", body: "{}" }),
  },

  // ── Messages & Défis ──────────────────────────────────
  messages: {
    /**
     * Liste les messages de l'utilisateur connecté.
     * @param {{ type?: string, status?: string, limit?: number, offset?: number }} params
     */
    list: ({ type = "", status = "", limit = 20, offset = 0 } = {}) =>
      get(`/messages?type=${type}&status=${status}&limit=${limit}&offset=${offset}`),

    /**
     * Envoie un message ou un défi à un ami.
     * @param {{ receiver_id: number, type: 'message'|'challenge', content?: string,
     *           challenge_mode?: string, challenge_score?: number, challenge_date?: string }} data
     */
    send: (data) => post("/messages/", data),

    /**
     * Marque un message comme lu / accepté.
     * @param {number} msgId
     * @param {'read'|'accepted'} status
     */
    updateStatus: (msgId, status) =>
      apiCall(`/messages/${msgId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    /**
     * Supprime un message.
     * @param {number} msgId
     */
    delete: (msgId) => apiCall(`/messages/${msgId}`, { method: "DELETE" }),
  },

  // ── Social Link ───────────────────────────────────────
  socialLink: {
    /**
     * Récupère les infos du Social Link par son id.
     * @param {number} linkId
     */
    get: (linkId) => get(`/social-links/${linkId}`),

    /**
     * Récupère (ou crée) le Social Link entre l'utilisateur connecté et un ami.
     * Retourne { link_id }.
     * @param {number} friendId  - user_id de l'ami
     */
    getByFriend: (friendId) => get(`/social-links/by-friend/${friendId}`),

    /**
     * Crée/résout le Social Link avec un ami et enregistre une interaction en 1 requête
     * (get_or_create + interact côté serveur, avec garde-fou d'amitié).
     * @param {number} friendId
     * @param {string} actionType
     */
    interactByFriend: (friendId, actionType) =>
      post(`/social-links/by-friend/${friendId}/interact`, { action_type: actionType }),

    /** Récupère les rank-up notifs en attente pour l'utilisateur connecté. */
    getRankUpNotifs: (lang = "en") => get(`/social-links/rankup-notifs?lang=${lang}`),
  },

  // ── Badges ────────────────────────────────────────────
  badges: {
    /**
     * Catalogue complet avec is_unlocked pour l'utilisateur courant.
     * @param {string} [lang] - 'fr'|'es'|'de'|'it' pour nom localisé (défaut: 'en')
     */
    catalog: (lang) => get(`/badges${lang ? "?lang=" + encodeURIComponent(lang) : ""}`),

    /**
     * Rachète un code événement.
     * @param {string} code
     */
    redeem: (code) => post("/badges/redeem", { code }),

    /**
     * Persiste le déblocage d'un badge côté serveur (fire-and-forget).
     * @param {string} badgeId
     */
    unlock: (badgeId) => post("/badges/unlock", { badge_id: badgeId }),
  },

  // ── Wallpapers ────────────────────────────────────────
  wallpapers: {
    /**
     * Catalogue complet avec is_unlocked pour l'utilisateur courant.
     */
    catalog: () => get("/wallpapers"),

    /**
     * Persiste le déblocage d'un wallpaper côté serveur (fire-and-forget).
     * @param {string} wallpaperId
     */
    unlock: (wallpaperId) => post("/wallpapers/unlock", { wallpaper_id: wallpaperId }),
  },

  // ── Titles ────────────────────────────────────────────
  titles: {
    /**
     * Persiste le déblocage d'un titre côté serveur (fire-and-forget).
     * @param {string} titleSlug
     */
    unlock: (titleSlug) => post("/titles/unlock", { title_slug: titleSlug }),
  },
};

// Exposer l'API globalement pour que gameCore.js puisse l'utiliser
// sans créer de dépendance d'import circulaire.
window._personadleApi = api;
