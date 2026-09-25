/**
 * animated_avatar_crop.test.js — un portrait animé ne passe pas par le canvas.
 *
 * Le recadrage dessine le portrait dans un `<canvas>`, qui n'en retient qu'une
 * image fixe : un portrait animé qui y entre en ressort mort. Le garde-fou qui
 * décide de l'y envoyer ou non testait `src.endsWith(".gif")`.
 *
 * Or les portraits animés de Kotone sont des **WebP** animés. Ils passaient donc
 * par le canvas et perdaient leur animation, pendant que ceux de Makoto
 * (`Yuki.gif`) l'échappaient. Signalé en production le 2026-09-25 : « les pdp de
 * Kotone ont du mal à s'animer, comme Makoto qui marche très bien ».
 *
 * Le test porte sur `isAnimatedAvatar()` — la décision elle-même — et non sur le
 * DOM du recadrage : c'est le prédicat qui était faux.
 */

import { describe, it, expect } from "vitest";
import { ANIMATED_AVATARS, isAnimatedAvatar } from "../profile/avatars_data.js";

describe("isAnimatedAvatar", () => {
  it("reconnaît les WebP animés de Kotone — le cas signalé", () => {
    for (const nom of [
      "kotone_shiomi_p3_anim_butterfly.webp",
      "kotone_shiomi_p3_anim_listening.webp",
      "kotone_shiomi_p3_anim_orpheus.webp",
      "kotone_shiomi_p3_anim_pink.webp",
    ]) {
      expect(isAnimatedAvatar(`../img/avatar/${nom}`), nom).toBe(true);
    }
  });

  it("reconnaît toujours les GIF animés, qui marchaient déjà", () => {
    expect(isAnimatedAvatar("../img/avatar/Yuki.gif")).toBe(true);
    expect(isAnimatedAvatar("../img/avatar/Ren2.gif")).toBe(true);
  });

  it("dit non à un portrait FIXE, qui doit rester recadrable", () => {
    // Le recadrage est une fonctionnalité voulue : l'interdire partout
    // « au cas où » la supprimerait pour la quasi-totalité de la galerie.
    expect(isAnimatedAvatar("../img/avatar/Makoto.jpg")).toBe(false);
    expect(isAnimatedAvatar("../img/avatar/Kotone.jpeg")).toBe(false);
    expect(isAnimatedAvatar("../img/avatar/P5X_FeMC.webp")).toBe(false);
  });

  it("ne se fie PAS à l'extension", () => {
    // Tout le défaut tenait là : `.webp` ne dit rien, et un `.gif` fixe
    // existerait tout aussi bien.
    const animes = [...ANIMATED_AVATARS];
    expect(
      animes.some((n) => n.endsWith(".webp")),
      "des WebP animés existent"
    ).toBe(true);
    expect(
      animes.every((n) => n.endsWith(".gif")),
      "la règle « ça finit par .gif » ne couvre pas la liste réelle"
    ).toBe(false);
  });

  it("accepte un simple nom de fichier comme un chemin complet", () => {
    expect(isAnimatedAvatar("Yuki.gif")).toBe(true);
    expect(isAnimatedAvatar("./img/avatar/Yuki.gif")).toBe(true);
  });

  it("tolère une entrée vide ou absente sans lever", () => {
    // `profile.avatar` peut valoir "none", null, ou une data-URL de recadrage.
    for (const v of ["", null, undefined, "none"]) {
      expect(isAnimatedAvatar(v)).toBe(false);
    }
  });

  it("toute la liste ANIMATED_AVATARS est reconnue", () => {
    const ratés = [...ANIMATED_AVATARS].filter((n) => !isAnimatedAvatar(`../img/avatar/${n}`));
    expect(ratés).toEqual([]);
  });
});
