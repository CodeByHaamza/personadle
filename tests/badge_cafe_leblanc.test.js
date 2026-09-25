/**
 * badge_cafe_leblanc.test.js — le badge secret Ko-fi.
 *
 * Il se débloque sur un drapeau de profil posé par le lien Ko-fi de l'accueil,
 * exactement comme `github_contributor` le fait avec le lien GitHub. Ce fichier
 * verrouille les deux choses qui rendraient ce badge faux :
 *
 *  - il ne doit s'accorder QUE sur ce drapeau — pas sur un profil vide, pas sur
 *    celui du badge GitHub. `[].every()` valant `true`, un badge sans condition
 *    réelle s'accorde à tout le monde : le dépôt s'est déjà fait avoir en 2.3 ;
 *  - il ne doit rien promettre qu'on ne puisse constater. Ko-fi ne dit rien au
 *    jeu de ce qui s'y passe : le jeu voit une visite, pas un don. Un texte qui
 *    remercierait d'un paiement affirmerait une chose que personne n'a vérifiée.
 */

import { describe, it, expect } from "vitest";
import { badgesList } from "../profile/badges/badgesData.js";

const badge = badgesList.find((b) => b.id === "cafe_leblanc");

describe("badge Café Leblanc", () => {
  it("existe, et reste secret", () => {
    expect(badge, "entrée cafe_leblanc").toBeDefined();
    expect(badge.secret).toBe(true);
    // Un badge secret n'affiche pas sa condition : c'est ce qui le rend secret.
    expect(badge.condition).toBe("???");
  });

  it("pointe sur une image WebP", () => {
    expect(badge.img).toMatch(/Badge_Cafe_Leblanc\.webp$/);
  });

  it("ne s'accorde QUE si le lien Ko-fi a été suivi", () => {
    expect(badge.check({}, { visitedKofi: true })).toBe(true);

    expect(badge.check({}, {})).toBe(false);
    expect(badge.check({}, { visitedKofi: false })).toBe(false);
    expect(badge.check({}, undefined)).toBe(false);
    // Le drapeau du badge GitHub ne doit pas l'ouvrir : deux liens, deux badges.
    expect(badge.check({}, { visitedGithub: true })).toBe(false);
  });

  it("n'accepte pas une valeur simplement « vraie » pour le drapeau", () => {
    // Le drapeau vient du localStorage, où tout peut arriver après une
    // désérialisation. Une comparaison lâche accorderait le badge sur "0", [] ou
    // n'importe quelle chaîne.
    for (const valeur of ["true", 1, "oui", [], {}]) {
      expect(badge.check({}, { visitedKofi: valeur }), String(valeur)).toBe(false);
    }
  });

  it("ne remercie pas d'un don, puisque le jeu n'en voit aucun", () => {
    const d = badge.description.toLowerCase();
    expect(d.length).toBeGreaterThan(20);
    for (const mot of ["donat", "support", "paid", "purchase", "contribution"]) {
      expect(d, `« ${mot} » affirmerait un paiement non constaté`).not.toContain(mot);
    }
  });
});
