/**
 * js/error_reporter.js — Remonte les erreurs JavaScript non rattrapées.
 *
 * Les derniers bugs de prod (titres en 500, bouton Rejouer disparu) ont été
 * signalés par des joueurs, pas vus par nous. Ce module écoute `error` et
 * `unhandledrejection` et envoie l'essentiel à api/client_errors.php, qui le
 * range dans error_log (admin) et prévient Discord à la première occurrence.
 *
 * Retenue, pour ne coûter ni bande passante ni vie privée :
 *   - au plus MAX_PER_PAGE envois par page, et chaque erreur une seule fois ;
 *   - bruit écarté tout de suite (extensions, « Script error. » de scripts tiers) ;
 *   - rien d'autre que le message, l'endroit, la pile, la page et le navigateur —
 *     ni saisie, ni localStorage, ni identité (le serveur lit la session s'il y en a une) ;
 *   - navigator.sendBeacon : l'envoi survit à la fermeture de la page et ne
 *     bloque jamais le jeu.
 *
 * Installé une fois par page, depuis js/api.js (chargé partout).
 */

const MAX_PER_PAGE = 5;
const NOISE = [
  /^Script error\.?$/im,
  /ResizeObserver loop/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  // Joueur hors ligne ou réseau coupé : pas un bug du jeu (le cache-first et la
  // file de sessions en attente gèrent déjà ce cas).
  /Failed to fetch|NetworkError when attempting|Load failed|network error/i,
];

/** Vrai si l'erreur est du bruit connu, pas un bug du jeu. */
export function isNoise({ message = "", source = "", stack = "" }) {
  if (!message) return true;
  const hay = `${message}\n${source}\n${stack}`;
  return NOISE.some((re) => re.test(hay));
}

/** Corps envoyé au serveur (tronqué : le serveur re-tronque de toute façon). */
export function buildReport(
  { message, source = "", line = 0, col = 0, stack = "", kind = "error" },
  loc = window.location
) {
  return {
    message: String(message).slice(0, 300),
    source: String(source).slice(0, 200),
    line: Number(line) || 0,
    col: Number(col) || 0,
    stack: String(stack).slice(0, 1500),
    page: loc.pathname.slice(0, 200),
    ua: (navigator.userAgent || "").slice(0, 200),
    kind,
  };
}

/** Normalise une `reason` de promesse rejetée (Error, chaîne, objet…). */
export function describeRejection(reason) {
  if (reason instanceof Error) {
    return { message: `${reason.name}: ${reason.message}`, stack: reason.stack ?? "" };
  }
  if (typeof reason === "string") return { message: reason, stack: "" };
  try {
    return { message: `Unhandled rejection: ${JSON.stringify(reason)}`.slice(0, 300), stack: "" };
  } catch {
    return { message: "Unhandled rejection", stack: "" };
  }
}

/**
 * Crée le rapporteur (sans l'installer) — séparé pour les tests.
 * @param {{ send: (body: object) => void }} transport
 */
export function createReporter({ send }) {
  const seen = new Set();
  let sent = 0;
  return function report(raw) {
    if (sent >= MAX_PER_PAGE || isNoise(raw)) return false;
    const key = `${raw.message}|${raw.source}|${raw.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    sent++;
    try {
      send(buildReport(raw));
    } catch {
      /* un rapporteur d'erreurs ne doit jamais en provoquer */
    }
    return true;
  };
}

function _endpoint() {
  const prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
  return `${prefix}/api/client_errors`;
}

function _send(body) {
  const json = JSON.stringify(body);
  if (navigator.sendBeacon?.(_endpoint(), new Blob([json], { type: "application/json" }))) return;
  fetch(_endpoint(), {
    method: "POST",
    body: json,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}

/** Installe les écouteurs globaux — une seule fois par page, jamais en local ni en test. */
export function installErrorReporter() {
  if (typeof window === "undefined" || window.__personadleErrorReporter) return;
  const host = window.location.hostname;
  // En local, la console suffit ; sous jsdom (Vitest), pas de réseau à déranger.
  if (host === "localhost" || host === "127.0.0.1" || /jsdom/i.test(navigator.userAgent)) return;
  const report = createReporter({ send: _send });
  window.__personadleErrorReporter = report;

  window.addEventListener("error", (e) => {
    // Une ressource qui ne charge pas (img, script) déclenche aussi `error`,
    // sans message : ce n'est pas une exception JavaScript.
    if (!e.message) return;
    report({
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack ?? "",
      kind: "error",
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    report({ ...describeRejection(e.reason), kind: "rejection" });
  });
}
