/**
 * tests-e2e/helpers/csrf.js — Helper CSRF pour les tests API Playwright.
 *
 * requireAuth() (api/bootstrap.php) vérifie un token CSRF double-submit sur
 * toute requête mutante authentifiée (POST/PATCH/DELETE). Un navigateur le lit
 * automatiquement depuis le cookie `csrf_token` (js/api.js), mais un
 * APIRequestContext Playwright ne le fait pas tout seul — il faut l'extraire
 * du cookie jar du contexte et le renvoyer explicitement en header.
 */

/**
 * Lit le cookie `csrf_token` du contexte et renvoie l'en-tête à fusionner dans
 * les options d'un appel mutant (post/patch/delete). Le cookie est posé dès la
 * première requête sur ce contexte (ex: register/login), donc disponible pour
 * tous les appels suivants.
 *
 * @param {import('@playwright/test').APIRequestContext} ctx
 * @returns {Promise<{ "X-CSRF-Token": string }>}
 */
export async function csrfHeader(ctx) {
  const { cookies } = await ctx.storageState();
  const csrf = cookies.find((c) => c.name === "csrf_token");
  if (!csrf) {
    throw new Error(
      "csrf_token cookie absent sur ce contexte — s'assurer qu'une requête " +
        "(ex: register/login) a déjà été faite dessus avant d'appeler csrfHeader()."
    );
  }
  return { "X-CSRF-Token": csrf.value };
}
