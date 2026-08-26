import { test, expect } from "@playwright/test";

// Compte pré-débloqué (tests-e2e/global-setup.js) : la porte d'entrée du Mode
// Expert (js/gameCore.js::applyExpertGate) redirige `?expert=1` vers le mode
// normal pour un visiteur non débloqué — ces tests couvrent le GAMEPLAY
// Expert, pas cette redirection.
test.use({ storageState: "playwright/.auth/music.json" });

/**
 * Mode Music Expert — parcours joueur complet.
 *
 * C'est le seul test qui exerce la boucle réelle : la mécanique est couverte
 * unitairement (pools, masquage, contenu), mais rien ne vérifiait que cliquer,
 * se tromper, voir un vers de plus apparaître, abandonner puis lire la révélation
 * fonctionne bout en bout dans un vrai navigateur.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT_URL = "/musicsMode/musics.html?expert=1";
const NORMAL_URL = "/musicsMode/musics.html";

/** Réponses volontairement impossibles — aucune chanson ne s'appelle ainsi. */
const wrongGuess = (i) => `Zzz Not A Real Song ${i}`;

/** Enchaîne n mauvaises réponses. */
async function guessWrong(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator("#textbar").fill(wrongGuess(i));
    await page.locator("#guessButton").click();
  }
}

test.describe("Mode Music Expert — bascule normal ⇄ expert", () => {
  test("le bouton Expert mène à l'URL Expert et retour", async ({ page }) => {
    await page.goto(NORMAL_URL);
    await page.waitForLoadState("networkidle");

    // En normal : lecteur audio visible, pas de panneau de paroles.
    await expect(page.locator("#audioBox")).toBeVisible();
    await expect(page.locator("#expertLyricsBox")).toBeHidden();

    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("expert=1");

    // En Expert : l'inverse exactement — l'audio donnerait la réponse.
    await expect(page.locator("#expertLyricsBox")).toBeVisible();
    await expect(page.locator("#audioBox")).toBeHidden();

    // Le bouton devient la sortie.
    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("expert=1");
    await expect(page.locator("#audioBox")).toBeVisible();
  });

  test("les deux modes ont des parties indépendantes le même jour", async ({ page }) => {
    await page.goto(NORMAL_URL);
    await page.waitForLoadState("networkidle");
    await guessWrong(page, 1);

    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    // Les clés localStorage sont préfixées séparément : jouer l'un ne consomme
    // pas les essais de l'autre.
    const keys = await page.evaluate(() => ({
      normal: localStorage.getItem("musicAttempts"),
      expert: localStorage.getItem("musicExpertAttempts"),
      normalTarget: localStorage.getItem("musicTarget"),
      expertTarget: localStorage.getItem("musicExpertTarget"),
    }));
    expect(keys.normal, "l'essai a été compté côté normal").toBe("1");
    expect(keys.expert, "l'Expert démarre à zéro, il ne partage pas le compteur").toBe("0");
    expect(keys.normalTarget).not.toBeNull();
    expect(keys.expertTarget).not.toBeNull();
  });
});

test.describe("Mode Music Expert — révélation des paroles", () => {
  test("un vers au départ, un de plus par erreur, les précédents restent", async ({ page }) => {
    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    const lines = page.locator("#expertLyricsList .expert-lyric-line");
    await expect(lines).toHaveCount(1);

    await guessWrong(page, 1);
    await expect(lines).toHaveCount(2);

    await guessWrong(page, 1);
    await expect(lines).toHaveCount(3);

    // Le dernier vers est mis en avant, et lui seul.
    await expect(page.locator("#expertLyricsList .expert-lyric-line.current")).toHaveCount(1);
    await expect(lines.nth(2)).toHaveClass(/current/);

    // Les précédents sont toujours là, donc relisibles en remontant.
    await expect(lines.nth(0)).toBeVisible();
    await expect(lines.nth(1)).toBeVisible();
  });

  test("le compteur de vers suit la révélation", async ({ page }) => {
    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    const counter = page.locator("#expertLyricsCount");
    // Le total dépend de la chanson tirée (5 à 30 vers) : on le lit au lieu de le
    // supposer, sinon le test casse un jour sur deux selon le tirage.
    const total = Number((await counter.textContent()).split("/")[1].trim());
    expect(total).toBeGreaterThan(1);
    await expect(counter).toHaveText(`1 / ${total}`);

    const pas = Math.min(2, total - 1);
    await guessWrong(page, pas);
    await expect(counter).toHaveText(`${1 + pas} / ${total}`);
  });

  test("le titre de la chanson est masqué dans les paroles pendant la partie", async ({ page }) => {
    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    // On épuise les essais pour voir un maximum de vers, puis on vérifie qu'aucun
    // ne laisse fuiter le titre — c'est le garde-fou du mode.
    const titre = await page.evaluate(() => JSON.parse(localStorage.getItem("musicExpertTarget")).titre);
    await guessWrong(page, 5);

    const texte = (await page.locator("#expertLyricsList").textContent()).toLowerCase();
    const base = titre.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
    if (base.length >= 4) {
      expect(texte, `le titre « ${titre} » ne doit pas apparaître avant la fin`).not.toContain(base);
    }
  });
});

test.describe("Mode Music Expert — abandon et révélation", () => {
  test("l'abandon se débloque après 5 erreurs, pas avant", async ({ page }) => {
    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    const giveUp = page.locator("#giveUpButton");
    const counter = page.locator("#giveUpCounter");

    await expect(counter).toHaveText("(0 / 5)");

    await guessWrong(page, 4);
    await expect(counter).toHaveText("(4 / 5)");
    await expect(counter).not.toHaveClass(/activated/);

    await guessWrong(page, 1);
    await expect(counter).toHaveText("(5 / 5)");
    await expect(counter).toHaveClass(/activated/);
    await expect(giveUp).toBeEnabled();
  });

  test("abandonner révèle toutes les paroles en clair et enregistre un giveup", async ({ page }) => {
    // Compte authentifié (storageState) : la session part directement en POST
    // /api/sessions au lieu d'atterrir dans la file `pendingSessions` (réservée
    // au hors-ligne/anonyme, cf. savePendingSession() dans js/gameCore.js) — on
    // intercepte donc la requête plutôt que de lire la file locale.
    const sessionRequests = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/sessions")) {
        sessionRequests.push(req.postDataJSON());
      }
    });

    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    const titre = await page.evaluate(() => JSON.parse(localStorage.getItem("musicExpertTarget")).titre);
    await guessWrong(page, 5);
    await page.locator("#giveUpButton").click();

    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });

    // La censure tombe : toutes les lignes sont affichées, sans masque.
    const texte = await page.locator("#expertLyricsList").textContent();
    expect(texte, "le masque doit disparaître en fin de partie").not.toContain("▮");

    const compteur = await page.locator("#expertLyricsCount").textContent();
    const [vus, total] = compteur.split("/").map((x) => x.trim());
    expect(vus, "toutes les paroles doivent être révélées").toBe(total);

    // La session est postée directement au serveur (compte débloqué) et porte
    // bien is_expert, sans quoi le serveur la compterait comme normale.
    await expect.poll(() => sessionRequests.length, { timeout: 5000 }).toBeGreaterThan(0);
    const last = sessionRequests[sessionRequests.length - 1];
    expect(last.mode).toBe("music");
    expect(last.is_expert).toBe(true);
    expect(last.result).toBe("giveup");
    expect(last.target_name).toBe(titre);
  });

  test("gagner révèle les paroles et enregistre une victoire Expert", async ({ page }) => {
    // Compte authentifié (storageState) : la session part directement en POST
    // /api/sessions au lieu d'atterrir dans la file `pendingSessions` (réservée
    // au hors-ligne/anonyme, cf. savePendingSession() dans js/gameCore.js) — on
    // intercepte donc la requête plutôt que de lire la file locale.
    const sessionRequests = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/sessions")) {
        sessionRequests.push(req.postDataJSON());
      }
    });

    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    // La cible est connue du client : on la lit pour jouer la bonne réponse.
    const titre = await page.evaluate(() => JSON.parse(localStorage.getItem("musicExpertTarget")).titre);

    await guessWrong(page, 2);
    await page.locator("#textbar").fill(titre);
    await page.locator("#guessButton").click();

    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });
    expect(await page.locator("#expertLyricsList").textContent()).not.toContain("▮");

    await expect.poll(() => sessionRequests.length, { timeout: 5000 }).toBeGreaterThan(0);
    const last = sessionRequests[sessionRequests.length - 1];
    expect(last.is_expert).toBe(true);
    expect(last.result).toBe("win");
    expect(last.attempts).toBe(3);
  });
});

test.describe("Mode Music Expert — responsive", () => {
  test("le panneau de paroles tient sur mobile sans scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(EXPERT_URL);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#expertLyricsBox")).toBeVisible();

    // On vérifie le panneau de paroles, pas la page entière : le débordement de la
    // barre de navigation du bas (.nav-item) est pré-existant et commun aux 6 modes,
    // hors périmètre de ce lot.
    const debord = await page.evaluate(() => {
      const r = document.getElementById("expertLyricsBox").getBoundingClientRect();
      return { left: r.left, right: r.right, client: document.documentElement.clientWidth };
    });
    expect(debord.left, "le panneau ne doit pas sortir à gauche").toBeGreaterThanOrEqual(0);
    expect(debord.right, "ni à droite").toBeLessThanOrEqual(debord.client + 1);
  });
});
