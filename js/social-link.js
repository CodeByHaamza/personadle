/**
 * js/social-link.js — Module Social Link côté client
 * ─────────────────────────────────────────────────────────
 * Exports :
 *   getSocialLinkData(friendId)
 *     → Récupère (via cache) les données du Social Link avec un ami
 *   renderSocialLinkGauge(friendId, container)
 *     → Insère la jauge XP dans un container HTML
 *   gainSocialLinkXp(friendId, actionType)
 *     → Déclenche une interaction + retourne le résultat
 *   showSocialLinkRankUp(newRank, rankNames?)
 *     → Animation Persona-style de montée en rang
 *   addFlameIfPlayedToday(friendEntry, el)
 *     → Ajoute la flamme 🔥 si on a joué ensemble aujourd'hui
 *   applyRank10Effect(avatarEl, pseudoEl, delayMs?)
 *     → Halo doré permanent + animation burst/typewriter (rang 10)
 */

/** Cache linkId par friendId pour la session. */
const _linkCache = new Map();

/** Traduit une clé i18n ou renvoie le fallback. */
function t(key, fallback) {
  const v = window.i18n?.t?.(key);
  return v != null && v !== key ? v : fallback;
}

// Rank names hardcoded (fixed game constants from social_link_ranks table)
const _RANK_NAMES_EN = [
  "",
  "Stranger",
  "Acquaintance",
  "Companion",
  "Ally",
  "Confidant",
  "Trusted Ally",
  "True Ally",
  "Bond",
  "Unbreakable Bond",
  "True Confidant",
];

/**
 * Récupère (et met en cache) le linkId pour un ami.
 * @param {number} friendId
 * @returns {Promise<number>}
 */
async function getLinkId(friendId) {
  if (_linkCache.has(friendId)) return _linkCache.get(friendId);
  const api = window._personadleApi;
  if (!api) throw new Error("API not available");
  const data = await api.socialLink.getByFriend(friendId);
  _linkCache.set(friendId, data.link_id);
  return data.link_id;
}

/**
 * Récupère les données complètes du Social Link avec un ami.
 * @param {number} friendId
 * @returns {Promise<object>}
 */
export async function getSocialLinkData(friendId) {
  const linkId = await getLinkId(friendId);
  return window._personadleApi.socialLink.get(linkId);
}

/**
 * Déclenche une interaction XP et retourne le résultat.
 * Utilise l'endpoint unifié by-friend/interact — 1 round-trip au lieu de 2.
 * @param {number} friendId
 * @param {string} actionType
 * @returns {Promise<{ link_id, xp_gained, is_mutual, new_xp, new_rank, ranked_up }>}
 * @throws {Error} on API unavailable or HTTP error (409 Already done today, 403 Not friends)
 */
export async function gainSocialLinkXp(friendId, actionType) {
  const api = window._personadleApi;
  if (!api) throw new Error("API not available");
  const result = await api.socialLink.interactByFriend(friendId, actionType);
  if (result?.link_id) _linkCache.set(friendId, result.link_id);
  return result;
}

/**
 * Rend la jauge Social Link dans un container HTML.
 * @param {number} friendId
 * @param {HTMLElement} container
 */
export async function renderSocialLinkGauge(friendId, container) {
  container.innerHTML = '<p class="sl-loading" style="font-size:0.8rem;color:#888">Loading…</p>';
  try {
    const data = await getSocialLinkData(friendId);
    _renderGauge(data, friendId, container);
  } catch {
    container.innerHTML = "";
  }
}

function _renderGauge(data, friendId, container) {
  const lang = document.documentElement.lang || "en";
  const rankName = data.rank_names?.[lang] || data.rank_names?.en || "";
  const xp = data.xp ?? 0;
  const xpCurrent = data.xp_current_rank ?? 0;
  const xpNext = data.xp_next_rank ?? null;
  const rank = data.rank ?? 1;
  const isMax = rank >= 10;

  // Wallpaper "Dark Shopping District" : mémorise le meilleur rang Social Link atteint.
  try {
    const _prof = JSON.parse(localStorage.getItem("personaUserProfile") || "null");
    if (_prof && rank > (_prof.bestSocialLinkRank || 0)) {
      _prof.bestSocialLinkRank = rank;
      localStorage.setItem("personaUserProfile", JSON.stringify(_prof));
    }
  } catch (_) {
    /* profil absent ou JSON invalide → ignorer */
  }

  const pct = isMax
    ? 100
    : xpNext
      ? Math.min(100, Math.round(((xp - xpCurrent) / (xpNext - xpCurrent)) * 100))
      : 0;

  const todayActions = (data.today_interactions ?? [])
    .filter((i) => i.initiator_id === window._currentUser?.id)
    .map((i) => i.action_type);

  // L'XP est gagné AUTOMATIQUEMENT en réalisant les vraies actions (visiter le
  // profil d'un ami, comparer ses stats, lancer/relever un défi, jouer le même
  // jour, partager). Plus de boutons : un simple tooltip explique comment monter.
  const doneToday = todayActions.length;

  const howtoRows = [
    ["👁", t("social.howto_visit", "Visit a friend's profile"), "+5"],
    ["📊", t("social.howto_share", "Share your score or streak"), "+10"],
    ["⚖", t("social.howto_compare", "Compare your stats"), "+10"],
    ["⚔", t("social.howto_challenge", "Send or beat a challenge"), "+15"],
    ["📅", t("social.howto_sameday", "Both play on the same day"), "+20"],
  ];

  container.innerHTML = `
    <div class="sl-gauge-wrap${isMax ? " sl-rank-10" : ""}">
      <div class="sl-gauge-header">
        <span class="sl-rank-name">Social Link</span>
        <span class="sl-rank-badge">Rank ${rank} — ${rankName}</span>
      </div>
      <div class="sl-bar-bg">
        <div class="sl-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="sl-xp-label">
        ${
          isMax
            ? t("social.max_rank", "✨ MAX — True Confidant")
            : `${xp} XP / ${xpNext ?? "?"} XP (${pct}%)`
        }
      </span>
      ${
        isMax
          ? ""
          : `
      <div class="sl-howto" tabindex="0" role="button"
           aria-label="${t("social.howto_aria", "How to gain Social Link XP")}">
        <span class="sl-howto-trigger">ℹ️ <span>${t("social.howto_trigger", "How to gain XP?")}</span></span>
        <div class="sl-howto-tip" role="tooltip">
          <div class="sl-howto-tip-title">${t("social.howto_title", "Spend time together — XP is automatic:")}</div>
          ${howtoRows
            .map(
              ([ic, label, xpv]) =>
                `<div class="sl-howto-row"><span class="sl-howto-ic">${ic}</span><span class="sl-howto-label">${label}</span><span class="sl-howto-xp">${xpv}</span></div>`
            )
            .join("")}
          <div class="sl-howto-note">${t("social.howto_mutual", "Mutual actions the same day give double XP. One reward per action per day.")}</div>
          ${doneToday ? `<div class="sl-howto-done">✅ ${t("social.howto_done_today", "{{n}} action(s) already counted today", { n: doneToday })}</div>` : ""}
        </div>
      </div>`
      }
    </div>
  `;
}

/** Rank-up phrases per rank (1-10) × 3 options × 5 languages. */
const _PHRASES = {
  en: [
    [],
    [
      // rank 1 (Stranger → Acquaintance)
      "A new connection has been made.",
      "The first thread is woven.",
      "Someone has entered your story.",
    ],
    [
      // rank 2
      "Familiarity begins to take root.",
      "Your paths cross more often now.",
      "A face in the crowd becomes familiar.",
    ],
    [
      // rank 3
      "Trust grows, one day at a time.",
      "You begin to walk the same road.",
      "Something unspoken is understood.",
    ],
    [
      // rank 4
      "A reliable presence at your side.",
      "Your bond has proven its worth.",
      "In battle and in rest, they stand beside you.",
    ],
    [
      // rank 5
      "A true Confidant stands with you.",
      "Secrets can be shared without fear.",
      "This bond carries weight beyond words.",
    ],
    [
      // rank 6
      "Unwavering. That is what you are to each other.",
      "The trust between you cannot be shaken.",
      "An alliance forged in shared moments.",
    ],
    [
      // rank 7
      "Side by side, you face whatever comes.",
      "No distance can weaken this bond.",
      "Your hearts resonate across any silence.",
    ],
    [
      // rank 8
      "A bond that defines who you are.",
      "Every hardship strengthened what you share.",
      "This connection has become part of you.",
    ],
    [
      // rank 9
      "Nothing can break what you have built.",
      "Unbreakable — forged through fire and time.",
      "The deepest bonds never fade.",
    ],
    [
      // rank 10
      "True Confidant. An unbreakable covenant.",
      "Two souls, one unwavering resolve.",
      "This bond will endure beyond any ending.",
    ],
  ],
  fr: [
    [],
    [
      "Un nouveau lien vient de naître.",
      "Le premier fil est tissé.",
      "Quelqu'un entre dans ton histoire.",
    ],
    [
      "La familiarité commence à s'installer.",
      "Vos chemins se croisent de plus en plus.",
      "Un visage dans la foule devient familier.",
    ],
    [
      "La confiance grandit, jour après jour.",
      "Vous commencez à marcher sur la même route.",
      "Quelque chose d'indicible se comprend.",
    ],
    [
      "Une présence fiable à tes côtés.",
      "Ce lien a prouvé sa valeur.",
      "Dans l'épreuve comme dans le repos, ils sont là.",
    ],
    [
      "Un vrai Confident se tient à tes côtés.",
      "Les secrets se partagent sans crainte.",
      "Ce lien porte un poids qui dépasse les mots.",
    ],
    [
      "Inébranlable. Voilà ce que vous êtes l'un pour l'autre.",
      "La confiance entre vous ne peut être ébranlée.",
      "Une alliance forgée dans des moments partagés.",
    ],
    [
      "Côte à côte, vous affrontez ce qui vient.",
      "Aucune distance ne peut affaiblir ce lien.",
      "Vos cœurs résonnent à travers chaque silence.",
    ],
    [
      "Un lien qui définit qui vous êtes.",
      "Chaque épreuve a renforcé ce que vous partagez.",
      "Cette connexion fait partie de vous désormais.",
    ],
    [
      "Rien ne peut briser ce que vous avez construit.",
      "Indestructible — forgé dans le feu et le temps.",
      "Les liens les plus profonds ne s'effacent jamais.",
    ],
    [
      "Vrai Confident. Un pacte indestructible.",
      "Deux âmes, une volonté inébranlable.",
      "Ce lien perdurera au-delà de toute fin.",
    ],
  ],
  es: [
    [],
    [
      "Se ha forjado una nueva conexión.",
      "El primer hilo ha sido tejido.",
      "Alguien ha entrado en tu historia.",
    ],
    [
      "La familiaridad empieza a echar raíces.",
      "Vuestros caminos se cruzan cada vez más.",
      "Un rostro entre la multitud se vuelve familiar.",
    ],
    [
      "La confianza crece, día a día.",
      "Comenzáis a caminar el mismo sendero.",
      "Algo no dicho es comprendido.",
    ],
    [
      "Una presencia confiable a tu lado.",
      "Vuestro vínculo ha demostrado su valor.",
      "En la batalla y en el descanso, están contigo.",
    ],
    [
      "Un verdadero Confidente está a tu lado.",
      "Los secretos se comparten sin miedo.",
      "Este vínculo tiene un peso más allá de las palabras.",
    ],
    [
      "Inquebrantable. Eso es lo que sois el uno para el otro.",
      "La confianza entre vosotros no puede tambalearse.",
      "Una alianza forjada en momentos compartidos.",
    ],
    [
      "Hombro con hombro, enfrentáis lo que venga.",
      "Ninguna distancia puede debilitar este vínculo.",
      "Vuestros corazones resuenan a través de cualquier silencio.",
    ],
    [
      "Un vínculo que define quiénes sois.",
      "Cada adversidad fortaleció lo que compartís.",
      "Esta conexión se ha vuelto parte de vosotros.",
    ],
    [
      "Nada puede romper lo que habéis construido.",
      "Inquebrantable — forjado en el fuego y el tiempo.",
      "Los vínculos más profundos nunca se desvanecen.",
    ],
    [
      "Confidente Verdadero. Un pacto inquebrantable.",
      "Dos almas, una resolución inquebrantable.",
      "Este vínculo perdurará más allá de cualquier final.",
    ],
  ],
  de: [
    [],
    [
      "Eine neue Verbindung wurde geknüpft.",
      "Der erste Faden ist gewoben.",
      "Jemand ist in deine Geschichte eingetreten.",
    ],
    [
      "Vertrautheit beginnt, Wurzeln zu schlagen.",
      "Eure Wege kreuzen sich immer öfter.",
      "Ein Gesicht in der Menge wird vertraut.",
    ],
    [
      "Vertrauen wächst, einen Tag nach dem anderen.",
      "Ihr beginnt denselben Weg zu gehen.",
      "Etwas Unausgesprochenes wird verstanden.",
    ],
    [
      "Eine verlässliche Präsenz an deiner Seite.",
      "Euer Band hat seinen Wert bewiesen.",
      "In der Schlacht und in der Ruhe stehen sie bei dir.",
    ],
    [
      "Ein wahrer Vertrauter steht an deiner Seite.",
      "Geheimnisse können ohne Angst geteilt werden.",
      "Dieses Band trägt ein Gewicht jenseits von Worten.",
    ],
    [
      "Unerschütterlich. Das seid ihr füreinander.",
      "Das Vertrauen zwischen euch kann nicht erschüttert werden.",
      "Ein Bündnis, geschmiedet in gemeinsamen Momenten.",
    ],
    [
      "Seite an Seite begegnet ihr allem, was kommt.",
      "Keine Distanz kann dieses Band schwächen.",
      "Eure Herzen resonieren durch jede Stille hindurch.",
    ],
    [
      "Ein Band, das definiert, wer ihr seid.",
      "Jede Härte hat gestärkt, was ihr teilt.",
      "Diese Verbindung ist ein Teil von euch geworden.",
    ],
    [
      "Nichts kann zerbrechen, was ihr aufgebaut habt.",
      "Unzerbrechlich — in Feuer und Zeit geschmiedet.",
      "Die tiefsten Bande verblassen nie.",
    ],
    [
      "Wahrer Vertrauter. Ein unzerbrechlicher Bund.",
      "Zwei Seelen, ein unerschütterlicher Wille.",
      "Dieses Band wird über jedes Ende hinaus bestehen.",
    ],
  ],
  it: [
    [],
    [
      "È nata una nuova connessione.",
      "Il primo filo è stato tessuto.",
      "Qualcuno è entrato nella tua storia.",
    ],
    [
      "La familiarità comincia a radicarsi.",
      "I vostri percorsi si incrociano sempre più spesso.",
      "Un volto tra la folla diventa familiare.",
    ],
    [
      "La fiducia cresce, giorno dopo giorno.",
      "Iniziate a percorrere la stessa strada.",
      "Qualcosa di non detto viene compreso.",
    ],
    [
      "Una presenza affidabile al tuo fianco.",
      "Il vostro legame ha dimostrato il suo valore.",
      "In battaglia e nel riposo, sono accanto a te.",
    ],
    [
      "Un vero Confidente è al tuo fianco.",
      "I segreti possono essere condivisi senza paura.",
      "Questo legame porta un peso che va oltre le parole.",
    ],
    [
      "Incrollabile. Questo è ciò che siete l'uno per l'altro.",
      "La fiducia tra voi non può essere scossa.",
      "Un'alleanza forgiata in momenti condivisi.",
    ],
    [
      "Fianco a fianco, affrontate ciò che viene.",
      "Nessuna distanza può indebolire questo legame.",
      "I vostri cuori risuonano attraverso ogni silenzio.",
    ],
    [
      "Un legame che definisce chi siete.",
      "Ogni difficoltà ha rafforzato ciò che condividete.",
      "Questa connessione è diventata parte di voi.",
    ],
    [
      "Nulla può spezzare ciò che avete costruito.",
      "Indistruttibile — forgiato nel fuoco e nel tempo.",
      "I legami più profondi non sbiadiscono mai.",
    ],
    [
      "Vero Confidente. Un patto indistruttibile.",
      "Due anime, una risoluzione incrollabile.",
      "Questo legame durerà oltre qualsiasi fine.",
    ],
  ],
};

/** Types character by character into el, then removes .sl-ru-typing when done. */
function _typewrite(el, text, charDelay = 38) {
  el.textContent = "";
  el.classList.add("sl-ru-typing");
  let i = 0;
  const tick = () => {
    el.textContent += text[i++];
    if (i < text.length) setTimeout(tick, charDelay);
    else el.classList.remove("sl-ru-typing");
  };
  setTimeout(tick, charDelay);
}

/** Resolves the /img/ base path regardless of current page depth. */
function _imgBase() {
  const base = window.location.pathname.startsWith("/personadle") ? "/personadle" : "";
  return `${base}/img/`;
}

/**
 * Normalise n'importe quelle src avatar en URL absolue exploitable.
 * Gère : data:, http(s):, chemin absolu /, chemins relatifs ./img/ ou ../img/ ou img/.
 * Retourne null si raw est falsy.
 */
function _normalizeSrc(raw) {
  if (!raw) return null;
  if (raw.startsWith("data:") || raw.startsWith("http") || raw.startsWith("/")) return raw;
  return raw.replace(/^\.\.?\/img\//, _imgBase()).replace(/^img\//, _imgBase());
}

/** Resolves avatar data-url or src from localStorage or explicit value. */
function _resolveAvatar(explicitSrc) {
  const raw =
    explicitSrc || JSON.parse(localStorage.getItem("personaUserProfile") || "{}").avatar || null;
  return _normalizeSrc(raw) || `${_imgBase()}default_avatar.png`;
}

/** Builds a sparkle particle. gold=true shifts color toward #ffd700. */
function _sparkle(_, i, arr, gold = false) {
  const top = 5 + Math.random() * 88;
  const left = 3 + Math.random() * 94;
  const tx = `translate(${Math.round((Math.random() - 0.5) * 220)}px,${Math.round((Math.random() - 0.65) * 250)}px)`;
  const delay = (Math.random() * 2.2).toFixed(2);
  const size = 2 + Math.round(Math.random() * 4);
  const color = gold
    ? Math.random() > 0.4
      ? "#ffd700"
      : "#fff8b0"
    : Math.random() > 0.5
      ? "#ffd700"
      : "#ff8800";
  return `<div class="sl-ru-sparkle" style="top:${top}%;left:${left}%;width:${size}px;height:${size}px;background:${color};--spark-tx:${tx};animation-delay:${delay}s"></div>`;
}

/**
 * Animation Persona-style de montée en rang Social Link.
 * Intensité croissante selon le rang (tier1→rank10).
 * @param {number} newRank
 * @param {object|null} rankNames  — { en, fr, … } ou null (fallback table interne)
 * @param {object} [opts]
 * @param {string} [opts.myAvatar]     — data-url ou src de l'avatar du joueur
 * @param {string} [opts.friendAvatar] — data-url ou src de l'avatar de l'ami
 * @param {string} [opts.friendPseudo] — pseudo de l'ami
 */
export function showSocialLinkRankUp(newRank, rankNames, opts = {}) {
  const lang = document.documentElement.lang || "en";
  const name = rankNames?.[lang] || rankNames?.en || _RANK_NAMES_EN[newRank] || `Rank ${newRank}`;

  const phraseLang = _PHRASES[lang] || _PHRASES.en;
  const phrasePool = phraseLang[Math.min(newRank, 10)] || _PHRASES.en[Math.min(newRank, 10)] || [];
  const phrase = phrasePool[Math.floor(Math.random() * phrasePool.length)] || "";

  // Tier determines visual intensity
  const tier = newRank >= 10 ? "rank10" : newRank >= 7 ? "tier3" : newRank >= 4 ? "tier2" : "tier1";
  const sparkleCount = tier === "rank10" ? 38 : tier === "tier3" ? 28 : tier === "tier2" ? 22 : 14;
  const goldSparkles = tier === "rank10" || tier === "tier3";
  const autoClose = tier === "rank10" ? 8500 : 6000;

  const myAvatarSrc = _resolveAvatar(opts.myAvatar);
  const friendAvatarSrc = _normalizeSrc(opts.friendAvatar) || `${_imgBase()}default_avatar.png`;
  const defAvatar = `${_imgBase()}default_avatar.png`;

  const mkImg = (src, alt) =>
    `<img class="sl-ru-node-img" src="${src}" alt="${alt}" onerror="this.src='${defAvatar}'">`;

  const tapHint = (() => {
    const v = window.i18n?.t?.("ui.tap_continue");
    return v && v !== "ui.tap_continue" ? v : "Tap to continue";
  })();

  const sparkles = Array.from({ length: sparkleCount }, (_, i, a) =>
    _sparkle(_, i, a, goldSparkles)
  ).join("");

  // Extra rings for tier3/rank10 (injected inside each node)
  const extraRing =
    tier === "tier3" || tier === "rank10"
      ? '<div class="sl-ru-node-ring sl-ru-node-ring--outer"></div>'
      : "";

  // rank10-only: 2 extra beam dots + a golden flash layer
  const extraDots =
    tier === "rank10"
      ? '<div class="sl-ru-dot sl-ru-dot--4"></div><div class="sl-ru-dot sl-ru-dot--5"></div>'
      : "";
  const flashLayer = tier === "rank10" ? '<div class="sl-ru-gold-flash"></div>' : "";

  document.getElementById("sl-rankup-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "sl-rankup-overlay";
  overlay.className = `sl-ru--${tier}`;
  overlay.innerHTML = `
    ${flashLayer}
    <div class="sl-ru-backdrop"></div>
    <div class="sl-ru-glow"></div>
    <div class="sl-ru-sparkle-field">${sparkles}</div>

    <div class="sl-ru-scene">
      <div class="sl-ru-node sl-ru-node--me">
        ${mkImg(myAvatarSrc, "You")}
        <div class="sl-ru-node-ring"></div>
        ${extraRing}
      </div>
      <div class="sl-ru-beam">
        <div class="sl-ru-beam-track"></div>
        <div class="sl-ru-beam-fill"></div>
        <div class="sl-ru-beam-center">◆</div>
        <div class="sl-ru-dot sl-ru-dot--1"></div>
        <div class="sl-ru-dot sl-ru-dot--2"></div>
        <div class="sl-ru-dot sl-ru-dot--3"></div>
        ${extraDots}
      </div>
      <div class="sl-ru-node sl-ru-node--friend">
        ${mkImg(friendAvatarSrc, opts.friendPseudo || "")}
        <div class="sl-ru-node-ring"></div>
        ${extraRing}
      </div>
    </div>

    <div class="sl-ru-card">
      <div class="sl-ru-card-title">— Social Link —</div>
      <div class="sl-ru-rank-num">RANK <strong>${newRank}</strong></div>
      <div class="sl-ru-separator"></div>
      <div class="sl-ru-name">${name}</div>
      <div class="sl-ru-phrase"></div>
      <div class="sl-ru-hint">${tapHint}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("sl-ru--in"));
  });

  if (phrase) {
    setTimeout(() => {
      const phraseEl = overlay.querySelector(".sl-ru-phrase");
      if (phraseEl) _typewrite(phraseEl, phrase, 36);
    }, 1300);
  }

  const close = () => {
    overlay.classList.remove("sl-ru--in");
    overlay.classList.add("sl-ru--out");
    setTimeout(() => overlay.remove(), 500);
  };

  overlay.addEventListener("click", close);
  setTimeout(close, autoClose);
}

// Expose globally so modules without a direct import can trigger it
window._showSocialLinkRankUp = showSocialLinkRankUp;

/**
 * Ajoute la flamme 🔥 à côté du pseudo d'un ami si on a interagi ensemble aujourd'hui.
 * @param {object} friendEntry  — objet retourné par api.friends.list()
 * @param {HTMLElement} el      — élément dans lequel injecter la flamme
 */
export function addFlameIfPlayedToday(friendEntry, el) {
  const lastInteraction = (friendEntry.social_link_last_interaction ?? "").slice(0, 10);
  if (!lastInteraction) return;
  const today = new Date().toISOString().slice(0, 10);
  if (lastInteraction === today) {
    el.insertAdjacentHTML(
      "beforeend",
      '<span class="fr-flame" title="Played together today!">🔥</span>'
    );
  }
}

/**
 * Applique l'effet visuel True Confidant (rang 10) sur un avatar et son pseudo.
 * Marqueur permanent : halo doré (.rank10-avatar) + icône ✦ (.rank10-icon).
 * Animation d'entrée : burst 8 particules + label typewriter "✦ True Confidant".
 * @param {HTMLElement} avatarEl  - Élément <img> ou <div> de l'avatar
 * @param {HTMLElement} pseudoEl  - Élément contenant le pseudo
 * @param {number}      [delayMs] - Délai avant l'animation (séquences décalées)
 */
export function applyRank10Effect(avatarEl, pseudoEl, delayMs = 0) {
  if (!avatarEl) return;

  const wrap = avatarEl.parentElement;
  if (wrap) wrap.style.position = wrap.style.position || "relative";

  avatarEl.classList.add("rank10-avatar");

  if (pseudoEl && !pseudoEl.querySelector(".rank10-icon")) {
    const icon = document.createElement("span");
    icon.className = "rank10-icon";
    icon.textContent = "✦";
    pseudoEl.appendChild(icon);
  }

  setTimeout(() => {
    if (!wrap) return;

    for (let i = 0; i < 8; i++) {
      const p = document.createElement("span");
      p.className = "rank10-particle";
      p.style.setProperty("--i", i);
      wrap.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }

    setTimeout(() => {
      if (!wrap) return;
      const label = document.createElement("div");
      label.className = "rank10-label";
      label.textContent = "✦ True Confidant";
      wrap.appendChild(label);

      setTimeout(() => {
        label.classList.add("rank10-label--out");
        setTimeout(() => label.remove(), 600);
      }, 1800);
    }, 600);
  }, delayMs);
}
