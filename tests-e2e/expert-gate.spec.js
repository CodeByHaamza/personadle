import { test, expect } from "@playwright/test";

/**
 * Porte d'entrée du Mode Expert — la redirection et le bouton verrouillé.
 *
 * Les six specs expert-*.spec.js partent d'un compte déjà débloqué
 * (tests-e2e/global-setup.js) et testent le GAMEPLAY Expert. Cette spec-ci teste
 * l'inverse : ce qui arrive à quelqu'un qui n'a PAS le droit d'y être.
 *
 * Ce qui est vérifié, et pourquoi ça vaut un test de bout en bout : le mode vit
 * dans l'URL, donc `?expert=1` se tape à la main. Le gate serveur
 * (api/sessions.php) refuse bien d'ENREGISTRER la session, mais sans la
 * redirection de `applyExpertGate()` (js/gameCore.js) le joueur non débloqué
 * jouerait quand même la partie — et découvrirait à la fin qu'elle ne compte pas.
 * Un test unitaire jsdom ne peut pas le prouver : jsdom n'implémente pas la
 * navigation, `tests/expertUnlock.test.js` doit remplacer `expertNavigate.go`.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const CLASSIC = "/classiqueMode/classiqueMode.html";
const SILHOUETTE = "/silhouetteMode/silhouette.html";

/** Le gate est asynchrone (il attend /api/user/expert-status) : laisser le réseau retomber. */
async function gotoAndSettle(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.describe("Porte d'entrée Expert — visiteur anonyme", () => {
  // Le déblocage est une propriété du COMPTE : sans compte, rien n'est
  // débloquable. Le défaut est fail-closed (cf. docblock de fetchExpertStatus).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("`?expert=1` tapé à la main renvoie au mode normal", async ({ page }) => {
    await gotoAndSettle(page, `${CLASSIC}?expert=1`);

    expect(page.url(), "l'anonyme ne doit pas rester sur l'URL Expert").not.toContain("expert=1");
    expect(page.url()).toContain("classiqueMode.html");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);
  });

  test("le bouton Expert est verrouillé sur la page normale", async ({ page }) => {
    await gotoAndSettle(page, CLASSIC);

    const toggle = page.locator("#expertToggle");
    await expect(toggle).toHaveClass(/expert-locked/);
    await expect(toggle).toHaveAttribute("aria-disabled", "true");
    // href retiré : un <a> sans href n'est ni activable ni copiable — le mode
    // ne doit pas être atteignable par un clic droit « copier le lien ».
    await expect(toggle).not.toHaveAttribute("href", /.*/);
  });

  test("le bouton verrouillé annonce sa condition", async ({ page }) => {
    await gotoAndSettle(page, CLASSIC);

    const toggle = page.locator("#expertToggle");
    // L'infobulle est reliée au bouton par aria-describedby : sans elle, le
    // joueur voit un bouton grisé sans savoir ce qu'on attend de lui.
    const tooltipId = await toggle.getAttribute("aria-describedby");
    expect(tooltipId, "le bouton verrouillé doit décrire sa condition").toBeTruthy();
    await expect(page.locator(`#${tooltipId}`)).toHaveCount(1);

    const label = await toggle.getAttribute("aria-label");
    expect(label, "aria-label = libellé + raison du verrou").toContain("—");
  });

  test("un rechargement ne finit pas par ouvrir le mode", async ({ page }) => {
    // Garde-fou contre un gate qui ne s'appliquerait qu'au premier rendu : le
    // cache localStorage de l'état de déblocage est justement là pour survivre
    // aux rechargements, il ne doit pas devenir une porte dérobée.
    await gotoAndSettle(page, `${CLASSIC}?expert=1`);
    await gotoAndSettle(page, `${CLASSIC}?expert=1`);

    expect(page.url()).not.toContain("expert=1");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);
  });
});

test.describe("Porte d'entrée Expert — compte débloqué sur un seul mode", () => {
  // Ce compte a rempli la condition de Classique, et elle seule
  // (tests-e2e/global-setup.js : un compte par mode).
  test.use({ storageState: "playwright/.auth/classic.json" });

  test("le mode débloqué reste accessible en `?expert=1`", async ({ page }) => {
    // Contre-preuve indispensable : sans elle, un gate qui redirigerait TOUT le
    // monde ferait passer les trois tests anonymes ci-dessus.
    await gotoAndSettle(page, `${CLASSIC}?expert=1`);

    expect(page.url()).toContain("expert=1");
    await expect(page.locator("body")).toHaveClass(/expert-mode/);
    await expect(page.locator("#expertToggle")).not.toHaveClass(/expert-locked/);
  });

  test("un mode NON débloqué du même compte renvoie au mode normal", async ({ page }) => {
    // Isolation par mode côté front : débloquer Classique n'ouvre pas Silhouette,
    // qui partage pourtant le même condition_type et le même seuil.
    await gotoAndSettle(page, `${SILHOUETTE}?expert=1`);

    expect(page.url(), "Silhouette n'est pas débloqué pour ce compte").not.toContain("expert=1");
    expect(page.url()).toContain("silhouette.html");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);
  });

  test("le bouton du mode non débloqué reste verrouillé", async ({ page }) => {
    await gotoAndSettle(page, SILHOUETTE);
    await expect(page.locator("#expertToggle")).toHaveClass(/expert-locked/);
  });
});
