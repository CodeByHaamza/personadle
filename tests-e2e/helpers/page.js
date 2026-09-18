/**
 * tests-e2e/helpers/page.js — navigation robuste à la fenêtre de maintenance.
 *
 * moderation.spec.js active le mode maintenance quelques centaines de ms au
 * milieu de la suite, et tout tourne en parallèle : une page chargée pile à ce
 * moment reçoit l'écran plein « maintenance » (#maintenanceScreen), qui
 * intercepte tous les clics jusqu'au rechargement. Ce n'est jamais ce qu'un
 * test conduit par l'interface veut mesurer : on recharge jusqu'à retrouver la
 * page normale — exactement ce qu'un joueur ferait.
 */

/**
 * `page.goto(url)` puis attente du réseau, en rechargeant tant que l'écran de
 * maintenance est là.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
export async function gotoSettled(page, url) {
  await page.goto(url);
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForLoadState("networkidle");
    if ((await page.locator("#maintenanceScreen").count()) === 0) return;
    await page.waitForTimeout(500);
    await page.reload();
  }
}
