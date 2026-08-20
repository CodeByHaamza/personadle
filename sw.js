/**
 * sw.js — Service Worker PersonaDLE
 * ────────────────────────────────────────────────────────────────
 * Stratégies :
 *   - Assets statiques (CSS, JS, fonts locales, images UI)
 *     → Cache-first : servis depuis le cache, mis à jour en fond.
 *   - Pages HTML des modes
 *     → Network-first avec fallback sur le cache.
 *   - Requêtes API (/api/*)
 *     → Network-only avec fallback silencieux (offline gracieux).
 *   - Google Fonts (cross-origin)
 *     → Stale-while-revalidate (cache + mise à jour en fond).
 *
 * Mise à jour du cache :
 *   Changer CACHE_VERSION déclenche la suppression de l'ancien cache
 *   et l'installation du nouveau au prochain chargement de page.
 * ────────────────────────────────────────────────────────────────
 */

const CACHE_VERSION = "personadle-v93";

// Préfixe du sous-dossier : '/personadle' en dev local, '' en production (racine).
// Calculé depuis l'URL du SW lui-même (ex: /personadle/sw.js → /personadle).
const SW_BASE = self.location.pathname.replace(/\/sw\.js$/, "");

/**
 * Assets à pré-cacher lors de l'installation.
 * SW_BASE corrige les chemins pour les déploiements en sous-dossier (ex: /personadle/).
 * Ne pas inclure les GIFs AOA (trop lourds) ni les portraits WebP (200+).
 */
const PRECACHE_URLS = [
  SW_BASE + "/",
  SW_BASE + "/index.html",
  SW_BASE + "/pages/404.html",

  /* Styles globaux */
  SW_BASE + "/css/global.css",
  SW_BASE + "/css/index.css",
  SW_BASE + "/css/filterMenu.css",
  SW_BASE + "/css/bottomNav.css",
  SW_BASE + "/css/langSelector.css",

  /* JS partagé */
  SW_BASE + "/js/gameCore.js",
  SW_BASE + "/js/filterMenu.js",
  SW_BASE + "/js/i18n.js",
  SW_BASE + "/js/api.js",
  SW_BASE + "/js/auth.js",

  /* Traductions */
  SW_BASE + "/lang/en.json",
  SW_BASE + "/lang/fr.json",

  /* Pages des 6 modes */
  SW_BASE + "/classiqueMode/classiqueMode.html",
  SW_BASE + "/emojiMode/emojiMode.html",
  SW_BASE + "/silhouetteMode/silhouette.html",
  SW_BASE + "/allOutAttackMode/allOutAttack.html",
  SW_BASE + "/personaeMode/personae.html",
  SW_BASE + "/musicsMode/musics.html",

  /* CSS des 6 modes */
  SW_BASE + "/classiqueMode/classique.css",
  SW_BASE + "/emojiMode/emoji.css",
  SW_BASE + "/silhouetteMode/silhouette.css",
  SW_BASE + "/allOutAttackMode/allOutAttack.css",
  SW_BASE + "/personaeMode/personae.css",
  SW_BASE + "/musicsMode/music.css",

  /* JS des 6 modes */
  SW_BASE + "/classiqueMode/modeClassique.js",
  SW_BASE + "/emojiMode/emojiMode.js",
  SW_BASE + "/silhouetteMode/modeSilhouette.js",
  SW_BASE + "/allOutAttackMode/modeAllOutAttack.js",
  SW_BASE + "/personaeMode/modePersonae.js",
  SW_BASE + "/musicsMode/modeMusic.js",

  /* Page profil */
  SW_BASE + "/profile/profile.html",
  SW_BASE + "/profile/profile-page.css",
  SW_BASE + "/profile/profile-page.js",
  SW_BASE + "/profile/profileStats.js",

  /* Pages amis & leaderboard */
  SW_BASE + "/profile/friends/friends.html",
  SW_BASE + "/profile/friends/friends.css",
  SW_BASE + "/profile/friends/friends.js",
  SW_BASE + "/profile/leaderboard/leaderboard.html",
  SW_BASE + "/profile/leaderboard/leaderboard.css",
  SW_BASE + "/profile/leaderboard/leaderboard.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pré-cache des assets critiques
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      /* skipWaiting permet à la nouvelle version d'être active immédiatement */
      self.skipWaiting();

      /* On filtre les assets qui pourraient ne pas exister (ex: img/logo.png)
         pour ne pas bloquer l'install si un fichier est manquant. */
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Précache échoué pour ${url}:`, err.message);
          })
        )
      );
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — supprime les anciens caches
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => {
              console.log(`[SW] Suppression ancien cache : ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        // Prendre le contrôle immédiatement de tous les onglets ouverts
        return self.clients.claim();
      })
      .then(() => {
        // Notifier tous les clients qu'un nouveau SW est actif → ils peuvent se recharger
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION })
          );
        });
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — stratégies de cache par type de requête
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ── 1. Requêtes API → network-only, fallback silencieux ──
     url.pathname.includes('/api/') gère les deux cas :
       - production  : /api/auth/me
       - dev local   : /personadle/api/auth/me   (sous-dossier Apache)
     Sans ça, les requêtes API tombaient dans cacheFirst → /api/auth/me
     était mis en cache avec {user:null} → déconnexion à chaque page. */
  if (url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline", message: "No network connection." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  /* ── 2. Google Fonts → stale-while-revalidate ── */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* ── 2b. CDN Cloudflare R2 (GIFs All-Out Attack) → network-only ──
     Le CDN gère déjà son propre cache HTTP — le double-cacher dans le SW
     créait des réponses "opaque" stale qui causaient le lag du mode AOA
     (Ctrl+Shift+R contournait le SW et fixait le problème). On laisse
     CloudFlare gérer seul sa mise en cache. */
  if (url.hostname === "pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev") {
    event.respondWith(fetch(request).catch(() => new Response("", { status: 408 })));
    return;
  }

  /* ── 3. Pages HTML → network-first, fallback cache ── */
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  /* ── 4. JS & CSS → network-first ──
     Toujours chercher la version fraîche sur le réseau, fallback cache si offline.
     Évite d'avoir à faire Ctrl+Shift+R après chaque déploiement. */
  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  /* ── 4b. Fichiers de langue JSON → network-first ──
     Les lang/*.json sont mis à jour à chaque ajout de clés i18n.
     Cache-first rendrait les nouvelles clés invisibles jusqu'à clear manuel. */
  if (url.pathname.includes("/lang/") && url.pathname.endsWith(".json")) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  /* ── 5. Images & sons → cache-first (rarement modifiés) ── */
  event.respondWith(cacheFirst(request));
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — stratégies nommées
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache-first : retourne la version en cache si disponible,
 * sinon fetch et met en cache pour la prochaine fois.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    /* Ne met en cache que les réponses valides */
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Ressource introuvable et pas en cache → réponse vide */
    return new Response("", { status: 408 });
  }
}

/**
 * Network-first : essaie le réseau, met à jour le cache si succès,
 * retourne le cache en cas d'erreur réseau.
 *
 * cache: 'no-cache' contourne le cache HTTP du navigateur — sans ça,
 * fetch() sert la version du cache disque du navigateur même depuis le SW,
 * ce qui rendait le Ctrl+Shift+R obligatoire après chaque modif CSS/JS.
 */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    /* Fallback ultime : page d'accueil ou 404 */
    return caches.match("/index.html") || new Response("Offline", { status: 503 });
  }
}

/**
 * Stale-while-revalidate : retourne immédiatement la version en cache
 * et met à jour le cache en arrière-plan.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}
