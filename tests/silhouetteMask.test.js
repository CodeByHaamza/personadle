/**
 * silhouetteMask.test.js — Noircissement de la silhouette dans ses pixels.
 *
 * Ce que ce fichier protège : « clic droit → Copier l'image » sur la silhouette
 * rendait le personnage à deviner, parce que `filter: brightness(0)` est un
 * effet de peinture, pas une modification du bitmap. Le correctif noircit hors
 * écran et ne met QUE le résultat dans le DOM.
 *
 * ⚠️ Limite de ce test, à connaître : jsdom n'implémente pas le rendu canvas
 * (`getContext("2d")` renvoie null sans le paquet `canvas`). On ne peut donc pas
 * vérifier ici que les pixels sortent bien noirs — seulement le CONTRAT du
 * helper, et surtout son comportement de repli. C'est justement le repli qui
 * compte le plus : s'il renvoyait autre chose que `null` en cas d'échec, le mode
 * afficherait une boîte vide au lieu d'une partie jouable. La vérification
 * visuelle du noircissement reste manuelle (TEST_PLAN §6.7).
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { blackenToDataURL } from "../js/silhouette_mask.js";

/** Fausse image chargée, avec les seules propriétés que lit le helper. */
function fakeImage({ naturalWidth = 400, naturalHeight = 600 } = {}) {
  return { naturalWidth, naturalHeight };
}

/**
 * Installe un canvas 2D simulé : jsdom n'en fournit aucun. Renvoie le contexte
 * espionné pour vérifier COMMENT le noircissement est fait.
 */
function stubCanvas({ dataUrl = "data:image/png;base64,iVBORw0KGgo=", ctx } = {}) {
  const context = ctx === undefined ? { drawImage: vi.fn(), fillRect: vi.fn() } : ctx;
  vi.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag !== "canvas") throw new Error(`createElement inattendu : ${tag}`);
    return {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: typeof dataUrl === "function" ? dataUrl : () => dataUrl,
    };
  });
  return context;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("blackenToDataURL — chemin nominal", () => {
  it("renvoie une data URL d'image", () => {
    stubCanvas();
    expect(blackenToDataURL(fakeImage())).toMatch(/^data:image\/png/);
  });

  it("noircit en `source-in`, pour conserver la transparence d'origine", () => {
    // C'est LE détail qui rend le résultat identique au pixel près à
    // brightness(0) : source-in ne peint que là où le pixel est opaque, donc la
    // découpe du personnage est préservée. Un fillRect en mode normal peindrait
    // un rectangle noir plein — silhouette illisible, mode injouable.
    const ctx = stubCanvas();
    blackenToDataURL(fakeImage());

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.globalCompositeOperation).toBe("source-in");
    expect(ctx.fillStyle).toBe("#000");
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("dessine à la taille naturelle de l'image", () => {
    const ctx = stubCanvas();
    blackenToDataURL(fakeImage({ naturalWidth: 123, naturalHeight: 456 }));
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 123, 456);
  });
});

describe("blackenToDataURL — replis, qui doivent tous rendre null", () => {
  // `null` = « je n'ai pas pu », et l'appelant retombe sur l'image d'origine
  // avec le filtre CSS. Une partie moins protégée reste infiniment préférable à
  // une partie injouable : ce module est un confort, pas un prérequis du jeu.

  it("sur une image absente ou de taille nulle", () => {
    expect(blackenToDataURL(null)).toBeNull();
    expect(blackenToDataURL(undefined)).toBeNull();
    expect(blackenToDataURL(fakeImage({ naturalWidth: 0 }))).toBeNull();
    expect(blackenToDataURL(fakeImage({ naturalHeight: 0 }))).toBeNull();
  });

  it("quand le contexte 2D est indisponible", () => {
    stubCanvas({ ctx: null });
    expect(blackenToDataURL(fakeImage())).toBeNull();
  });

  it("quand toDataURL lève — cas du canvas teinté par une image cross-origin", () => {
    // C'est exactement ce qui arriverait en All-Out Attack : ses GIFs viennent
    // d'un CDN cross-origin, donc le canvas est teinté et l'export interdit.
    stubCanvas({
      dataUrl: () => {
        throw new Error("SecurityError: tainted canvas");
      },
    });
    expect(blackenToDataURL(fakeImage())).toBeNull();
  });

  it("quand toDataURL renvoie autre chose qu'une data URL d'image", () => {
    // Certains moteurs renvoient "data:," au lieu de lever.
    stubCanvas({ dataUrl: "data:," });
    expect(blackenToDataURL(fakeImage())).toBeNull();
  });
});
