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

const CACHE_VERSION = 'personadle-v11';

/**
 * Assets à pré-cacher lors de l'installation.
 * Ne pas inclure les GIFs AOA (trop lourds) ni les portraits WebP (200+).
 * Le reste du contenu est mis en cache à la première visite (runtime caching).
 */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/404.html',

  /* Styles globaux */
  '/css/global.css',
  '/css/index.css',
  '/css/filterMenu.css',
  '/css/bottomNav.css',
  '/css/langSelector.css',

  /* JS partagé */
  '/js/gameCore.js',
  '/js/filterMenu.js',
  '/js/i18n.js',
  '/js/api.js',

  /* Traductions (EN et FR au minimum) */
  '/lang/en.json',
  '/lang/fr.json',

  /* Pages des 6 modes */
  '/classiqueMode/classiqueMode.html',
  '/emojiMode/emojiMode.html',
  '/silhouetteMode/silhouette.html',
  '/allOutAttackMode/allOutAttack.html',
  '/personaeMode/personae.html',
  '/musicsMode/musics.html',

  /* CSS des 6 modes */
  '/classiqueMode/classique.css',
  '/emojiMode/emoji.css',
  '/silhouetteMode/silhouette.css',
  '/allOutAttackMode/allOutAttack.css',
  '/personaeMode/personae.css',
  '/musicsMode/music.css',

  /* JS des 6 modes */
  '/classiqueMode/modeClassique.js',
  '/emojiMode/emojiMode.js',
  '/silhouetteMode/modeSilhouette.js',
  '/allOutAttackMode/modeAllOutAttack.js',
  '/personaeMode/modePersonae.js',
  '/musicsMode/modeMusic.js',

  /* Page profil */
  '/profile/profile.html',
  '/profile/profile-page.css',
  '/profile/profile-page.js',
  '/profile/profile.js',
  '/profile/profileStats.js',

  /* Pages amis & leaderboard */
  '/profile/friends.html',
  '/profile/friends.css',
  '/profile/friends.js',
  '/profile/leaderboard.html',
  '/profile/leaderboard.css',
  '/profile/leaderboard.js',

  /* JS partagé auth */
  '/js/auth.js',

  /* Sons */
  '/assets/sound_effect/Victory_sound.mp3',
  '/assets/sound_effect/Select_sound.mp3',

  /* Images UI principales */
  '/img/logo.png',
];


// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pré-cache des assets critiques
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log(`[SW] Suppression ancien cache : ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // Prendre le contrôle immédiatement de tous les onglets ouverts
      return self.clients.claim();
    }).then(() => {
      // Notifier tous les clients qu'un nouveau SW est actif → ils peuvent se recharger
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
      });
    })
  );
});


// ─────────────────────────────────────────────────────────────────────────────
// FETCH — stratégies de cache par type de requête
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ── 1. Requêtes API → network-only, fallback silencieux ── */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'No network connection.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  /* ── 2. Google Fonts → stale-while-revalidate ── */
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* ── 3. Pages HTML → network-first, fallback cache ── */
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  /* ── 4. JS & CSS → stale-while-revalidate ──
     Sert immédiatement depuis le cache (rapide) ET met à jour en fond.
     Garantit que la prochaine visite aura la dernière version.
     Plus sûr que cache-first qui peut bloquer les mises à jour en dev. */
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(staleWhileRevalidate(request));
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
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Ressource introuvable et pas en cache → réponse vide */
    return new Response('', { status: 408 });
  }
}

/**
 * Network-first : essaie le réseau, met à jour le cache si succès,
 * retourne le cache en cas d'erreur réseau.
 */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    /* Fallback ultime : page d'accueil ou 404 */
    return caches.match('/index.html') || new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-while-revalidate : retourne immédiatement la version en cache
 * et met à jour le cache en arrière-plan.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}
