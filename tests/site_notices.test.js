/**
 * site_notices.test.js — js/site_notices.js (migration 042)
 *
 * Écran de maintenance (joueur) vs bandeau (admin), annonces fermables et
 * mémorisées, messages de l'équipe accusés, reset ciblé de l'état local, et
 * le message de ban détaillé au login (js/auth.js resolveBanMessage).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  showMaintenance,
  showAnnouncements,
  showTeamNotices,
  applyRemoteLocalReset,
  applySiteNotices,
} from "../js/site_notices.js";
import { resolveBanMessage } from "../js/auth.js";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = "";
  document.body.className = "";
  document.head.querySelectorAll("#siteNoticesCss").forEach((l) => l.remove());
  window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html");
  window._currentUser = { id: 1 };
  delete window._personadleApi;
  window.i18n = { t: (k) => k, getCurrentLang: () => "fr" };
});

describe("maintenance", () => {
  it("joueur : écran plein, message FR, retour prévu, corps verrouillé, CSS injecté", () => {
    showMaintenance({
      message_fr: "Migration",
      message_en: "Migration EN",
      until: "2026-09-15 21:30:00",
    });
    const screen = document.getElementById("maintenanceScreen");
    expect(screen).not.toBeNull();
    expect(screen.textContent).toContain("Migration");
    expect(screen.textContent).not.toContain("Migration EN");
    expect(screen.querySelector(".maintenance-card__until")).not.toBeNull();
    expect(document.body.classList.contains("maintenance-active")).toBe(true);
    expect(document.getElementById("siteNoticesCss").getAttribute("href")).toBe(
      "../css/site_notices.css"
    );
  });

  it("admin : simple bandeau avec lien vers l'admin, pas d'écran", () => {
    showMaintenance({ message_fr: "Migration" }, { isAdmin: true });
    expect(document.getElementById("maintenanceScreen")).toBeNull();
    const banner = document.querySelector(".site-banner--maintenance");
    expect(banner).not.toBeNull();
    expect(banner.querySelector(".site-banner__link").getAttribute("href")).toBe(
      "../admin/index.html"
    );
  });

  it("langue non française : message EN, repli FR si absent", () => {
    window.i18n.getCurrentLang = () => "de";
    showMaintenance({ message_fr: "FR seulement", message_en: null });
    expect(document.getElementById("maintenanceScreen").textContent).toContain("FR seulement");
  });

  it("rien sans maintenance", () => {
    showMaintenance(null);
    expect(document.getElementById("maintenanceScreen")).toBeNull();
  });
});

describe("annonces", () => {
  it("un bandeau par annonce, fermable et mémorisé par id", () => {
    showAnnouncements([
      { id: 7, level: "warning", message_fr: "Classement gelé", message_en: "Frozen" },
      { id: 8, level: "info", message_fr: "Nouveau : Compendium" },
    ]);
    expect(document.querySelectorAll(".site-banner")).toHaveLength(2);
    document.querySelector('.site-banner[data-id="7"] .site-banner__close').click();
    expect(document.querySelectorAll(".site-banner")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("dismissedAnnouncements"))).toEqual([7]);

    document.body.innerHTML = "";
    showAnnouncements([{ id: 7, level: "warning", message_fr: "Classement gelé" }]);
    expect(document.querySelectorAll(".site-banner"), "fermée = ne revient pas").toHaveLength(0);
  });
});

describe("messages de l'équipe", () => {
  it("affiche les messages en attente et accuse au clic", async () => {
    const markRead = vi.fn().mockResolvedValue({ read: true });
    window._personadleApi = {
      notices: {
        pending: vi.fn().mockResolvedValue({
          notices: [{ id: 3, type: "warning", message: "Dernier avertissement" }],
        }),
        markRead,
      },
    };
    await showTeamNotices();
    const card = document.querySelector(".site-banner--notice");
    expect(card.textContent).toContain("Dernier avertissement");
    card.querySelector(".site-banner__ack").click();
    expect(document.querySelector(".site-banner--notice")).toBeNull();
    expect(markRead).toHaveBeenCalledWith(3);
  });

  it("invité ou API muette : rien", async () => {
    delete window._currentUser;
    window._personadleApi = { notices: { pending: vi.fn() } };
    await showTeamNotices();
    expect(window._personadleApi.notices.pending).not.toHaveBeenCalled();
  });
});

describe("reset ciblé de l'état local", () => {
  it("vide l'état des modes (normal + Expert) et les défis, puis accuse ; pas deux fois", () => {
    localStorage.setItem("target", "x");
    localStorage.setItem("emojiGameOver", "true");
    localStorage.setItem("classicExpert_attempts", "3");
    localStorage.setItem("gameId_Classic", "abc");
    localStorage.setItem("activeChallenge", "{}");
    localStorage.setItem("lastPlayedDate_Classic", "2026-09-14");
    localStorage.setItem("personaUserProfile", '{"stats":{"streak":4}}');
    localStorage.setItem("lang", "fr");

    expect(applyRemoteLocalReset("2026-09-15 10:00:00")).toBe(true);
    for (const k of [
      "target",
      "emojiGameOver",
      "classicExpert_attempts",
      "gameId_Classic",
      "activeChallenge",
      "lastPlayedDate_Classic",
    ]) {
      expect(localStorage.getItem(k), k).toBeNull();
    }
    expect(
      localStorage.getItem("personaUserProfile"),
      "le profil local n'est pas touché"
    ).not.toBeNull();
    expect(localStorage.getItem("lang")).toBe("fr");

    localStorage.setItem("target", "y");
    expect(applyRemoteLocalReset("2026-09-15 10:00:00"), "même demande → déjà accusée").toBe(false);
    expect(localStorage.getItem("target")).toBe("y");
    expect(applyRemoteLocalReset(null)).toBe(false);
  });
});

describe("applySiteNotices", () => {
  it("rien sur les pages admin", () => {
    window.history.replaceState({}, "", "/admin/index.html");
    applySiteNotices({
      user: null,
      maintenance: { message_fr: "x" },
      announcements: [{ id: 1, level: "info", message_fr: "a" }],
    });
    expect(document.getElementById("maintenanceScreen")).toBeNull();
    expect(document.querySelectorAll(".site-banner")).toHaveLength(0);
  });

  it("admin connecté pendant la maintenance : bandeau, et les annonces", () => {
    applySiteNotices({
      user: { id: 1, is_admin: true },
      maintenance: { message_fr: "x" },
      announcements: [{ id: 1, level: "info", message_fr: "a" }],
    });
    expect(document.getElementById("maintenanceScreen")).toBeNull();
    expect(document.querySelector(".site-banner--maintenance")).not.toBeNull();
    expect(document.querySelector(".site-banner--info")).not.toBeNull();
  });
});

describe("resolveBanMessage (login)", () => {
  it("raison + échéance quand le serveur renvoie code banned", () => {
    const msg = resolveBanMessage({
      data: { code: "banned", reason: "Triche", until: "2026-09-16 19:53:43" },
    });
    // i18n factice : _t() de auth.js retombe sur les libellés EN
    expect(msg).toContain("suspended until");
    expect(msg).toContain("Triche");
  });
  it("définitif sans raison, et null si ce n'est pas un ban", () => {
    expect(resolveBanMessage({ data: { code: "banned" } })).toBe("Account banned.");
    expect(resolveBanMessage({ data: { error: "Invalid email or password" } })).toBeNull();
    expect(resolveBanMessage(new Error("x"))).toBeNull();
  });
});
