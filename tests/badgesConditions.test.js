import { describe, it, expect } from "vitest";
import { badgesList } from "../profile/badges/badgesData.js";

/**
 * Garde-fou anti-régression sur les CONDITIONS de déblocage des badges.
 * Aurait attrapé les 3 bugs "wins vs games" (Kamoshida-class) :
 *   - un profil vierge ne doit débloquer AUCUN badge ("always true")
 *   - un badge "Win N games in X mode" doit lire modeWins, jamais modeCount.
 */
describe("badges — conditions de déblocage", () => {
  const byId = (id) => badgesList.find((b) => b.id === id);

  it("expose une liste non vide de badges avec un check()", () => {
    expect(badgesList.length).toBeGreaterThan(0);
    for (const b of badgesList) expect(typeof b.check).toBe("function");
  });

  it("aucun check() ne plante sur des entrées vides ou minimales", () => {
    for (const b of badgesList) {
      expect(() => b.check({}, {})).not.toThrow();
      expect(() =>
        b.check({ modeWins: {}, modeCount: {} }, { eventCodes: [], foundPQCharacters: [] })
      ).not.toThrow();
    }
  });

  it("aucun badge ne se débloque sur un profil VIERGE (anti 'always true')", () => {
    const unlocked = badgesList.filter((b) => {
      try {
        return b.check({}, {});
      } catch {
        return false;
      }
    });
    expect(unlocked.map((b) => b.id)).toEqual([]);
  });

  it("les badges 'Win N games' ne se débloquent PAS via modeCount seul (parties jouées)", () => {
    const winBadges = badgesList.filter((b) => /win\s+\d+\s+games?/i.test(b.condition || ""));
    expect(winBadges.length).toBeGreaterThan(0);
    const huge = {
      Classic: 999,
      Emoji: 999,
      Silhouette: 999,
      Music: 999,
      Personae: 999,
      AllOut: 999,
      AllOutAttack: 999,
    };
    for (const b of winBadges) {
      expect(b.check({ modeCount: huge, modeWins: {} }, {})).toBe(false);
    }
  });

  it("p1_p2_fan : 15 VICTOIRES Classic (pas 15 parties)", () => {
    const b = byId("p1_p2_fan");
    expect(b.check({ modeCount: { Classic: 15 }, modeWins: {} }, {})).toBe(false);
    expect(b.check({ modeWins: { Classic: 15 } }, {})).toBe(true);
  });

  it("velvet_master : 10 VICTOIRES Personae (pas 10 parties)", () => {
    const b = byId("velvet_master");
    expect(b.check({ modeCount: { Personae: 10 }, modeWins: {} }, {})).toBe(false);
    expect(b.check({ modeWins: { Personae: 10 } }, {})).toBe(true);
  });

  it("shadow_slayer / music_master / emoji_decoder utilisent bien modeWins", () => {
    expect(byId("shadow_slayer").check({ modeWins: { Silhouette: 5 } }, {})).toBe(true);
    expect(byId("music_master").check({ modeWins: { Music: 20 } }, {})).toBe(true);
    expect(byId("emoji_decoder").check({ modeWins: { Emoji: 10 } }, {})).toBe(true);
  });

  it("chaque badge référence un id et une catégorie", () => {
    for (const b of badgesList) {
      expect(b.id).toBeTruthy();
      expect(b.category).toBeTruthy();
    }
  });
});
