/**
 * challengeAccept.test.js — Le clic « Accepter » d'une notification de défi.
 *
 * C'EST le chemin qui produisait le bug le plus visible en 2.0 : « j'accepte un
 * défi, j'arrive sur la page du mode, et il n'y a pas de défi ».
 *
 * L'ordre historique était : marquer le message `accepted` côté serveur → purger
 * l'état du mode → écrire `activeChallenge` → PUIS chercher la page de
 * destination. Deux façons d'échouer, toutes deux silencieuses :
 *
 *   1. `mode.toLowerCase()` nu ne canonise pas « All Out Attack » : la clé
 *      « all out attack » est absente de MODE_PAGE / MODE_STATE_KEYS /
 *      FILTER_STORAGE_KEYS. Aucune redirection, aucune purge, aucun filtre —
 *      mais le défi était déjà `accepted` côté serveur, donc définitivement
 *      bloqué : ni jouable, ni annulable.
 *   2. `updateStatus(...).catch(() => {})` avalait l'échec réseau : le local
 *      croyait le défi accepté, le serveur non. Défi fantôme.
 *
 * Les helpers de gameCore sont déjà couverts (challengeExpertScope,
 * challengeAbandon) ; ce fichier couvre l'orchestration entre eux, qui ne
 * l'était pas.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  activeChallengeKey,
  getPendingActiveChallenge,
  parisDateKey,
} from "../js/gameCore.js";

// challenge-notif.js garde une file et un drapeau `_busy` au niveau du module :
// une notification acceptée redirige sans jamais refermer l'overlay, donc `_busy`
// resterait vrai et les tests suivants n'afficheraient plus rien. On réimporte le
// module à neuf avant chaque test.
let queueChallengeNotifs;
let setChallengeNotifDismissHandler;

/** Dernière URL demandée via `window.location.href = …` (jsdom ne navigue pas). */
let navigatedTo = null;
let updateStatus;

/** Payload minimal d'un défi entrant, tel que le construit notifications.js. */
function challenge(overrides = {}) {
  return {
    id: 42,
    senderPseudo: "Yosuke",
    senderAvatar: null,
    mode: "classic",
    score: 3,
    date: parisDateKey(),
    senderId: 7,
    challengeFilters: null,
    challengeTarget: "Yu Narukami",
    ...overrides,
  };
}

/** Affiche la notification et clique « Accepter ». */
async function accept(payload) {
  queueChallengeNotifs([challenge(payload)]);
  const btn = document.querySelector(".cn-btn--accept");
  expect(btn, "la notification de défi ne s'est pas affichée").toBeTruthy();
  btn.click();
  // Le handler est async (updateStatus) : laisser la file de microtâches se vider.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Ce qui a été écrit dans la case de la dimension demandée, ou null. */
function stored(isExpert = false) {
  const raw = localStorage.getItem(activeChallengeKey(isExpert));
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  vi.resetModules();
  ({ queueChallengeNotifs, setChallengeNotifDismissHandler } = await import(
    "../js/challenge-notif.js"
  ));

  localStorage.clear();
  document.body.innerHTML = "";
  navigatedTo = null;
  updateStatus = vi.fn().mockResolvedValue({ ok: true });

  window.history.replaceState({}, "", "/profile/friends/friends.html");

  // jsdom lève « Not implemented: navigation » sur une écriture de location.href.
  // On observe l'intention de navigation au lieu de la subir.
  delete window.location;
  window.location = { pathname: "/profile/friends/friends.html" };
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => navigatedTo,
    set: (v) => {
      navigatedTo = v;
    },
  });

  window._personadleApi = { messages: { updateStatus } };
  window.showToast = vi.fn();
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  delete window._personadleApi;
  delete window.showToast;
  vi.restoreAllMocks();
});

describe("accepter un défi — jour de jeu", () => {
  it("date la case au jour d'ACCEPTATION, pas au jour de création du défi", async () => {
    // LE bug « redirigé mais pas de défi, et bloqué en défi en cours » : un ami
    // envoie son défi à 23 h 55, on l'accepte le lendemain matin. La case portait
    // alors `challenge_date` (hier), et toutes ses lectures la comparent au jour
    // courant — donc bannière supprimée au chargement, cible dédiée ignorée (on
    // rejoue celle du jour), et statut `accepted` que plus rien ne résout.
    // Rien ne s'y oppose : la cible et le score voyagent dans le message, ils ne
    // dépendent d'aucune date.
    await accept({ date: "2020-01-01" });

    expect(stored()?.date).toBe(parisDateKey());
    // Le jour d'origine reste consultable, pour l'affichage et le débogage.
    expect(stored()?.challengeDate).toBe("2020-01-01");
  });

  it("le défi accepté est immédiatement reconnu comme actif pour aujourd'hui", async () => {
    await accept({ date: "2020-01-01", mode: "classic" });

    // getPendingActiveChallenge() applique la même frontière de journée que la
    // bannière et que les 6 modes : s'il ne le voit pas, personne ne le verra.
    expect(getPendingActiveChallenge(false)?.msgId).toBe(42);
  });
});

describe("accepter un défi — chemin nominal", () => {
  it("redirige vers la page du mode et pose la case activeChallenge", async () => {
    await accept({ mode: "classic" });

    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
    expect(updateStatus).toHaveBeenCalledWith(42, "accepted");
    expect(stored()).toMatchObject({ msgId: 42, mode: "classic", target: "Yu Narukami" });
  });

  it("canonise un nom de mode non normalisé (le bug « page sans défi »)", async () => {
    // « All Out Attack » avec espaces : c'est la forme que le serveur peut
    // renvoyer. Avec l'ancien `.toLowerCase()` nu, MODE_PAGE["all out attack"]
    // était undefined → aucune redirection, mais le défi était déjà accepté.
    await accept({ mode: "All Out Attack" });

    expect(navigatedTo).toBe("../../allOutAttackMode/allOutAttack.html");
    expect(stored()?.mode).toBe("alloutattack");
  });

  it("envoie sur la page Expert quand le défi est Expert", async () => {
    await accept({ mode: "silhouette", challengeIsExpert: true });

    expect(navigatedTo).toBe("../../silhouetteMode/silhouette.html?expert=1");
    // Rangé dans la case Expert, et SEULEMENT là : un défi normal en cours ne
    // doit être ni écrasé ni résolu par cette partie.
    expect(stored(true)).toMatchObject({ mode: "silhouette", isExpert: true });
    expect(stored(false)).toBeNull();
  });

  it("laisse originalFilters à null quand le joueur n'a jamais touché ses filtres", async () => {
    // Et non `"[]"` : filterMenu.js lit un tableau vide comme « tout
    // désélectionné » (choix volontaire), là où l'absence de clé vaut « tout
    // actif ». Restaurer "[]" en fin de défi donnerait un mode sans aucun opus.
    await accept({ mode: "classic", challengeFilters: '["P4"]' });

    expect(stored()?.originalFilters).toBeNull();
  });
});

describe("accepter un défi — échecs, qui doivent tous être fermés", () => {
  it("n'écrit RIEN et n'accepte rien si le mode n'a pas de page", async () => {
    await accept({ mode: "modeQuiNExistePas" });

    // Le point crucial : ne pas avoir prévenu le serveur. Un défi marqué
    // `accepted` sans destination est définitivement bloqué côté joueur.
    expect(updateStatus).not.toHaveBeenCalled();
    expect(stored()).toBeNull();
    expect(navigatedTo).toBeNull();
    expect(window.showToast).toHaveBeenCalled();
  });

  it("n'écrit RIEN si le serveur refuse l'acceptation", async () => {
    updateStatus.mockRejectedValue(new Error("500"));

    await accept({ mode: "classic" });

    // Écrire activeChallenge ici ferait diverger local et serveur : c'est le
    // défi fantôme « en cours » que personne ne peut plus résoudre.
    expect(stored()).toBeNull();
    expect(navigatedTo).toBeNull();
    expect(window.showToast).toHaveBeenCalled();
  });

  it("n'écrit RIEN quand le bridge API est absent (hors ligne)", async () => {
    delete window._personadleApi;

    await accept({ mode: "classic" });

    expect(stored()).toBeNull();
    expect(navigatedTo).toBeNull();
  });

  it("refuse un second défi de la MÊME dimension sans rien toucher", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey() })
    );

    await accept({ mode: "classic" });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(navigatedTo).toBeNull();
    expect(stored()?.msgId).toBe(1); // le défi en cours est intact
  });

  it("accepte un défi Expert alors qu'un défi normal est en cours", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey() })
    );

    await accept({ mode: "emoji", challengeIsExpert: true });

    // Deux dimensions = deux jeux : elles coexistent.
    expect(navigatedTo).toBe("../../emojiMode/emojiMode.html?expert=1");
    expect(stored(false)?.msgId).toBe(1);
    expect(stored(true)?.msgId).toBe(42);
  });
});

describe("notification — fermeture explicite vs manquée", () => {
  /**
   * notifications.js ne persiste plus « déjà vu » avant l'affichage : une
   * notification que le joueur n'a jamais vue (navigation dans la seconde,
   * plein écran par-dessus) était perdue POUR TOUJOURS alors que le message
   * restait `unread` côté serveur — la cause n°1 des « parfois pas d'animation ».
   * Le « vu » persistant est désormais posé par ce module, et seulement quand le
   * joueur ferme réellement la notification.
   */
  it("accepter n'a pas besoin du drapeau « vu » : le statut serveur suffit", async () => {
    const dismissed = vi.fn();
    setChallengeNotifDismissHandler(dismissed);

    await accept({ mode: "classic" });

    // Le message passe `accepted` côté serveur, et le sondage ne remonte que les
    // `unread` : il ne peut plus revenir. Marquer « vu » en plus n'apporterait
    // rien et masquerait un éventuel échec d'acceptation.
    expect(updateStatus).toHaveBeenCalledWith(42, "accepted");
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
    expect(dismissed).not.toHaveBeenCalled();
  });

  it("signale la fermeture quand le joueur refuse", async () => {
    const dismissed = vi.fn();
    setChallengeNotifDismissHandler(dismissed);

    queueChallengeNotifs([challenge()]);
    document.querySelector(".cn-btn--refuse").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dismissed).toHaveBeenCalledWith(42);
    expect(updateStatus).toHaveBeenCalledWith(42, "read");
  });

  it("signale la fermeture quand le joueur ferme par la croix", async () => {
    const dismissed = vi.fn();
    setChallengeNotifDismissHandler(dismissed);

    queueChallengeNotifs([challenge()]);
    document.querySelector(".cn-close").click();

    // « Plus tard » explicite : le message reste `unread` (donc visible sur la
    // page Amis) mais on ne le relance pas au prochain sondage.
    expect(dismissed).toHaveBeenCalledWith(42);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("ne signale rien tant que le joueur n'a pas répondu", async () => {
    const dismissed = vi.fn();
    setChallengeNotifDismissHandler(dismissed);

    queueChallengeNotifs([challenge()]);

    expect(document.querySelector(".cn-btn--accept")).toBeTruthy();
    expect(dismissed).not.toHaveBeenCalled();
  });
});

describe("notification — double clic sur Accepter", () => {
  it("n'accepte le défi qu'une seule fois", async () => {
    // Deux allers-retours réseau séparent le clic de la redirection : un joueur
    // qui reclique parce que « rien ne se passe » lançait deux acceptations —
    // et deux gains d'XP Social Link.
    queueChallengeNotifs([challenge()]);
    const btn = document.querySelector(".cn-btn--accept");
    btn.click();
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateStatus).toHaveBeenCalledTimes(1);
  });

  it("rouvre les boutons quand l'acceptation échoue, pour laisser refuser", async () => {
    updateStatus.mockRejectedValue(new Error("500"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await accept({ mode: "classic" });

    expect(navigatedTo).toBeNull();
    expect(document.querySelector(".cn-btn--accept").disabled).toBe(false);
    expect(document.querySelector(".cn-btn--refuse").disabled).toBe(false);
  });
});

describe("notification — la destination doit exister", () => {
  /**
   * La destination était ABSOLUE, avec un seul cas particulier codé en dur
   * (`pathname.startsWith("/personadle/")` → "/personadle", sinon ""). Le site
   * n'est à la racine du domaine qu'en prod : partout ailleurs — sous-dossier,
   * préproduction, ou « …/personadle » SANS slash final, qui ne déclenche même
   * pas le test — accepter menait sur une 404, avec un défi déjà `accepted`
   * côté serveur. Bloqué, et sans page où aller.
   */
  it("résout la page du mode relativement, depuis un sous-dossier profond", async () => {
    window.location.pathname = "/profile/friends/friends.html";

    await accept({ mode: "classic" });

    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
  });

  it("résout la page du mode relativement, depuis la racine", async () => {
    window.location.pathname = "/index.html";

    await accept({ mode: "classic" });

    expect(navigatedTo).toBe("./classiqueMode/classiqueMode.html");
  });

  it("reste correct sous une racine de site arbitraire (ex. /jeux/personadle)", async () => {
    // Le cas qui produisait la 404 : la racine n'est ni « / » ni « /personadle/ ».
    // Un lien relatif n'a pas à la connaître.
    window.location.pathname = "/jeux/personadle/profile/profile.html";

    await accept({ mode: "music" });

    expect(navigatedTo).toBe("../musicsMode/musics.html");
  });
});
