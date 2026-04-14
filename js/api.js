/**
 * js/api.js — Couche d'abstraction pour tous les appels vers le backend PersonaDLE.
 *
 * Utilisation :
 *   import { api } from '../js/api.js';
 *   await api.auth.login({ email, password });
 *   await api.stats.sync('Classic', sessionData);
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

// Détecte tout environnement local : file://, localhost, 127.0.0.1, LAN (192.168.x, 10.x)
const IS_DEV = (
  window.location.hostname === ''          ||   // file://
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'   ||
  /^192\.168\./.test(window.location.hostname) ||
  /^10\./.test(window.location.hostname)
);

// Local Apache : projet servi depuis /personadle/ (symlink via setup.sh)
// Docker       : projet servi depuis / (DocumentRoot = /var/www/html)
// Prod         : Hostinger, projet à la racine du domaine
// → On détecte si le pathname commence par /personadle/ pour le préfixer.
const _pathPrefix = window.location.pathname.startsWith('/personadle/') ? '/personadle' : '';
const BASE_URL = window.location.hostname === 'personadle.net'
  ? 'https://personadle.net/api'
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
    this.name    = 'ApiError';
    this.status  = status;
    this.data    = data;
  }
}


// ─────────────────────────────────────────────────────────
// WRAPPER FETCH
// ─────────────────────────────────────────────────────────

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
    credentials: 'include',  // envoie les cookies de session PHP
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
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
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Shortcut pour un appel GET.
 * @param {string} endpoint
 */
function get(endpoint) {
  return apiCall(endpoint, { method: 'GET' });
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
    register: (data) => post('/auth/register', data),

    /**
     * Connecte l'utilisateur (session PHP httpOnly).
     * @param {{ email: string, password: string }} data
     */
    login: (data) => post('/auth/login', data),

    /** Déconnecte l'utilisateur (détruit la session serveur). */
    logout: () => post('/auth/logout', {}),

    /**
     * Retourne le profil de l'utilisateur connecté, ou null si non connecté.
     * À appeler au chargement de page pour restaurer l'état de connexion.
     */
    me: () => get('/auth/me'),
  },

  // ── Utilisateur & profil ──────────────────────────────
  user: {
    /**
     * Récupère le profil complet d'un utilisateur.
     * @param {number} userId
     */
    get: (userId) => get(`/user/${userId}`),

    /**
     * Met à jour le profil (avatar, pseudo, thème, wallpaper…).
     * @param {number} userId
     * @param {object} data
     */
    update: (userId, data) => apiCall(`/user/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

    /**
     * Migre le profil localStorage vers le compte cloud (appelé une seule fois au register).
     * @param {{ profile: object|null, pendingSessions: object[] }} payload
     */
    migrate: (payload) => post('/user/migrate', payload),

    /**
     * Récupère les wallpapers disponibles pour l'utilisateur :
     * ceux marqués is_default + ceux débloqués.
     * @param {number} userId
     */
    wallpapers: (userId) => get(`/user/${userId}/wallpapers`),

    /**
     * Supprime le compte (soft delete RGPD — hard delete différé J+30).
     * @param {number} userId
     */
    delete: (userId) => apiCall(`/user/${userId}`, { method: 'DELETE' }),
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
    postSession: (session) => post('/sessions', session),

    /**
     * Synchronise les sessions en attente stockées dans localStorage.
     * À appeler après une reconnexion ou au chargement si l'user est connecté.
     */
    syncPending: async () => {
      const pending = JSON.parse(localStorage.getItem('pendingSessions') || '[]');
      if (!pending.length) return;

      for (const session of pending) {
        try {
          await api.stats.postSession(session);
        } catch (e) {
          // En cas d'échec partiel, on laisse les sessions en localStorage
          console.warn('⚠️ Session sync failed:', e.message);
          return;
        }
      }
      // Toutes les sessions envoyées — vider la queue
      localStorage.removeItem('pendingSessions');
    },
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
     * Récupère le profil public d'un joueur par friend_code ou pseudo.
     * @param {{ code?: string, pseudo?: string }} params
     */
    get: ({ code, pseudo }) => {
      const q = code ? `code=${encodeURIComponent(code)}` : `pseudo=${encodeURIComponent(pseudo)}`;
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
    list: ({ q = '', limit = 30, offset = 0 } = {}) =>
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
      get(`/community-stats?mode=${encodeURIComponent(mode)}&date=${encodeURIComponent(date)}&target=${encodeURIComponent(target)}`),
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
    get: ({ mode = 'all', period = 'ever', metric = 'wins', limit = 50, offset = 0 } = {}) =>
      get(`/leaderboard/?mode=${mode}&period=${period}&metric=${metric}&limit=${limit}&offset=${offset}`),
  },

  // ── Amis ──────────────────────────────────────────────
  friends: {
    /** Récupère la liste d'amis + demandes en attente de l'utilisateur connecté. */
    list: () => get('/friends'),

    /**
     * Envoie une demande d'ami par friend_code.
     * @param {string} friendCode - Code de 8 caractères
     */
    request: (friendCode) => post('/friends', { friend_code: friendCode }),

    /**
     * Accepte ou refuse une demande reçue.
     * @param {number} friendshipId
     * @param {'accept'|'decline'} action
     */
    respond: (friendshipId, action) => apiCall(`/friends/${friendshipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),

    /**
     * Supprime un ami ou retire une demande envoyée.
     * @param {number} friendshipId
     */
    remove: (friendshipId) => apiCall(`/friends/${friendshipId}`, { method: 'DELETE' }),
  },

  // ── Social Link ───────────────────────────────────────
  socialLink: {
    /**
     * Récupère les données du Social Link entre l'utilisateur et un ami.
     * @param {number} linkId
     */
    get: (linkId) => get(`/social-links/${linkId}`),

    /**
     * Enregistre une interaction (visite de profil, partage de streak…).
     * @param {number} linkId
     * @param {{ action_type: string }} data
     */
    interact: (linkId, data) => post(`/social-links/${linkId}/interact`, data),
  },

  // ── Badges ────────────────────────────────────────────
  badges: {
    /**
     * Récupère les badges débloqués d'un utilisateur.
     * @param {number} userId
     */
    get: (userId) => get(`/user/${userId}/badges`),

    /**
     * Rachète un code événement.
     * @param {string} code
     */
    redeem: (code) => post('/badges/redeem', { code }),
  },
};

// Exposer l'API globalement pour que gameCore.js puisse l'utiliser
// sans créer de dépendance d'import circulaire.
window._personadleApi = api;
