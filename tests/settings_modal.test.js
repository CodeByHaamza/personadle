/**
 * settings_modal.test.js — js/settings-modal.js
 *
 * Couvre le lot 2.2 « réglages d'autoplay de la musique de profil » :
 *   - deux réglages indépendants (mon profil / profil des autres), vrais par défaut
 *   - la modale les expose et les sauvegarde avec les autres réglages
 *   - l'id utilisateur est résolu à la sauvegarde, pas à l'init — sur les pages
 *     de mode, le bouton ⚙ est monté avant que initAuth() ait posé _currentUser
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initSettingsModal,
  openSettingsModal,
  profileAutoplayAllowed,
  readPlayerSettings,
} from "../js/settings-modal.js";

beforeEach(() => {
  document.body.innerHTML = `<button id="settingsBtn">⚙</button>`;
  localStorage.clear();
  delete window._currentUser;
  delete window._personadleApi;
  vi.restoreAllMocks();
});

describe("profileAutoplayAllowed", () => {
  it("autorise l'autoplay par défaut, sur mon profil comme sur les autres", () => {
    expect(profileAutoplayAllowed("own")).toBe(true);
    expect(profileAutoplayAllowed("others")).toBe(true);
  });

  it("les deux réglages sont indépendants", () => {
    localStorage.setItem("personaSettings", JSON.stringify({ profile_autoplay_own: false }));
    expect(profileAutoplayAllowed("own")).toBe(false);
    expect(profileAutoplayAllowed("others")).toBe(true);

    localStorage.setItem("personaSettings", JSON.stringify({ profile_autoplay_others: false }));
    expect(profileAutoplayAllowed("own")).toBe(true);
    expect(profileAutoplayAllowed("others")).toBe(false);
  });

  it("un cache local corrompu retombe sur les défauts", () => {
    localStorage.setItem("personaSettings", "{pas du json");
    expect(profileAutoplayAllowed("own")).toBe(true);
    expect(readPlayerSettings().sound_enabled).toBe(true);
  });
});

describe("modale — réglages d'autoplay", () => {
  it("expose les deux interrupteurs, cochés par défaut", () => {
    initSettingsModal();
    openSettingsModal();
    expect(document.getElementById("smProfileAutoplayOwn").checked).toBe(true);
    expect(document.getElementById("smProfileAutoplayOthers").checked).toBe(true);
  });

  it("recharge l'état sauvegardé à l'ouverture", () => {
    localStorage.setItem(
      "personaSettings",
      JSON.stringify({ profile_autoplay_own: false, profile_autoplay_others: true })
    );
    initSettingsModal();
    openSettingsModal();
    expect(document.getElementById("smProfileAutoplayOwn").checked).toBe(false);
    expect(document.getElementById("smProfileAutoplayOthers").checked).toBe(true);
  });

  it("sauvegarde les deux réglages avec les autres, en local et en cloud", async () => {
    const update = vi.fn().mockResolvedValue({});
    window._personadleApi = { user: { update } };
    initSettingsModal(42);
    openSettingsModal();

    document.getElementById("smProfileAutoplayOwn").checked = false;
    document.getElementById("smSave").click();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    const [userId, payload] = update.mock.calls[0];
    expect(userId).toBe(42);
    expect(payload.settings).toMatchObject({
      profile_autoplay_own: false,
      profile_autoplay_others: true,
      sound_enabled: true,
    });
    expect(JSON.parse(localStorage.getItem("personaSettings")).profile_autoplay_own).toBe(false);
    expect(profileAutoplayAllowed("own")).toBe(false);
  });

  it("résout l'id utilisateur à la sauvegarde quand l'init n'en avait pas", async () => {
    // Pages de mode : initSettingsModal() tourne avant initAuth(). L'id doit
    // venir de window._currentUser au moment du clic, sinon le réglage ne
    // partirait jamais en cloud depuis ces pages.
    const update = vi.fn().mockResolvedValue({});
    window._personadleApi = { user: { update } };
    initSettingsModal();
    window._currentUser = { id: 7 };
    openSettingsModal();

    document.getElementById("smSave").click();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe(7);
  });

  it("sans compte, sauvegarde en local seulement", async () => {
    initSettingsModal();
    openSettingsModal();
    document.getElementById("smProfileAutoplayOthers").checked = false;
    document.getElementById("smSave").click();
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem("personaSettings")).profile_autoplay_others).toBe(
        false
      )
    );
  });
});
