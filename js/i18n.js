/**
 * i18n.js — Système de traduction de PersonaDLE
 * ──────────────────────────────────────────────
 * Usage :
 *   import { setLang, t } from './js/i18n.js';
 *   await setLang('fr');              // charge fr.json et applique toute la page
 *   t('ui.submit')                   // → "Valider"
 *   t('game.win_message', { count: 3 }) // → "Trouvé en 3 essai(s) !"
 *
 * Conventions HTML :
 *   data-i18n="key"               → met à jour textContent
 *   data-i18n-placeholder="key"   → met à jour placeholder
 *   data-i18n-title="key"         → met à jour l'attribut title
 *
 * Fallback : si la clé est absente dans la langue choisie,
 *   on retourne la valeur EN. Si absente en EN aussi, on
 *   retourne la clé brute (ex. "ui.submit").
 *
 * Variables dynamiques : syntaxe {{variable}}
 *   "win_message": "Found in {{count}} attempt(s)!"
 *   t('game.win_message', { count: 3 }) → "Found in 3 attempt(s)!"
 */

const STORAGE_KEY  = 'lang';
const DEFAULT_LANG = 'en';
const SUPPORTED    = ['en', 'fr', 'es', 'de', 'it'];

/** Traductions actives (objet aplati : "ui.submit" → "Submit") */
let _flat    = {};
/** Traductions EN de secours */
let _flatEN  = {};
/** Code de la langue actuelle */
let _current = DEFAULT_LANG;


/* ─── Utilitaires internes ─────────────────────────────── */

/**
 * Aplatit un objet JSON imbriqué en clés pointées.
 * { modes: { classic: { title: "…" } } }
 * → { "modes.classic.title": "…" }
 */
function flatten(obj, prefix) {
  var result = {};
  prefix = prefix || '';
  Object.keys(obj).forEach(function (k) {
    var fullKey = prefix ? prefix + '.' + k : k;
    var val     = obj[k];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flatten(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  });
  return result;
}

/**
 * Charge un fichier lang/xx.json via fetch.
 * Retourne l'objet aplati, ou null si erreur.
 */
/* Chemin absolu vers lang/ — résolu depuis i18n.js lui-même
   (toujours js/i18n.js → ../lang/), peu importe la page qui l'importe */
var _langBase = new URL('../lang/', import.meta.url).href;

async function fetchLang(lang) {
  var url = _langBase + lang + '.json';
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    return flatten(data);
  } catch (e) {
    console.warn('[i18n] Cannot load ' + lang + '.json :', e.message);
    return null;
  }
}

/** Applique toutes les traductions [data-i18n*] dans le DOM courant. */
function applyToDOM() {
  /* textContent */
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var val = _flat[key] !== undefined ? _flat[key] : _flatEN[key];
    if (val !== undefined) el.textContent = val;
  });

  /* placeholder */
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-placeholder');
    var val = _flat[key] !== undefined ? _flat[key] : _flatEN[key];
    if (val !== undefined) el.placeholder = val;
  });

  /* title attribute */
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-title');
    var val = _flat[key] !== undefined ? _flat[key] : _flatEN[key];
    if (val !== undefined) el.title = val;
  });

  /* Blocs HTML entiers — visibles uniquement pour la langue active */
  document.querySelectorAll('[data-i18n-block]').forEach(function (el) {
    el.style.display = el.getAttribute('data-i18n-block') === _current ? '' : 'none';
  });
}


/* ─── API publique ─────────────────────────────────────── */

/**
 * Traduit une clé avec substitution de variables optionnelle.
 * Fallback : valeur EN → clé brute.
 * @param {string} key   - clé pointée (ex: "ui.submit")
 * @param {object} [vars] - variables { count: 3 }
 * @returns {string}
 */
export function t(key, vars) {
  vars = vars || {};
  var str = _flat[key] !== undefined ? _flat[key]
          : _flatEN[key] !== undefined ? _flatEN[key]
          : key;
  return str.replace(/\{\{(\w+)\}\}/g, function (_, name) {
    return vars[name] !== undefined ? vars[name] : '{{' + name + '}}';
  });
}

/** Retourne le code de la langue actuellement chargée. */
export function getCurrentLang() {
  return _current;
}

/**
 * Charge une langue et l'applique à toute la page.
 * Sauvegarde dans localStorage('lang').
 * Fallback automatique sur EN si le fichier est introuvable.
 * @param {string} lang - code ISO 639-1 (en, fr, es, de)
 * @returns {Promise<void>}
 */
export async function setLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;

  /* On mémorise la langue demandée avant tout fallback */
  var requested = lang;

  /* Charge EN de secours une seule fois */
  if (Object.keys(_flatEN).length === 0) {
    var en = await fetchLang(DEFAULT_LANG);
    if (en) _flatEN = en;
  }

  var data = null;
  if (lang !== DEFAULT_LANG) {
    data = await fetchLang(lang);
  }
  /* Si la langue demandée est EN ou si le fetch a échoué → utiliser EN */
  if (!data) {
    data = _flatEN;
    lang = DEFAULT_LANG;
  }

  _flat    = data;
  _current = lang;
  /* On sauvegarde la langue DEMANDÉE (pas le fallback EN) pour
     que le choix de l'utilisateur persiste même en cas d'erreur réseau */
  localStorage.setItem(STORAGE_KEY, requested);
  document.documentElement.lang = lang;
  applyToDOM();
}

/**
 * Initialise i18n au chargement de la page :
 * lit localStorage ou détecte la langue navigateur,
 * puis applique les traductions.
 * @returns {Promise<void>}
 */
/**
 * Initialise i18n au chargement de la page :
 * lit localStorage ou détecte la langue navigateur,
 * puis applique les traductions.
 * @returns {Promise<string>} la langue effectivement chargée
 */
export async function initLang() {
  var saved    = localStorage.getItem(STORAGE_KEY);
  var browser  = (navigator.language || '').slice(0, 2).toLowerCase();
  var preferred = SUPPORTED.includes(saved)   ? saved
                : SUPPORTED.includes(browser) ? browser
                : DEFAULT_LANG;
  await setLang(preferred);
  return _current;
}

/* Expose sur window pour les scripts non-module (compatibilité) */
window.i18n = { t: t, setLang: setLang, getCurrentLang: getCurrentLang };
