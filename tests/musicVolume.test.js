/**
 * musicVolume.test.js — contrôle de volume du lecteur du mode Music.
 *
 * initVolumeControl() est exporté de modeMusic.js et accepte l'élément audio en
 * paramètre : jsdom n'exécute pas DOMContentLoaded à l'import, donc la référence
 * interne au <audio> de la page n'est jamais assignée en test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { initVolumeControl } from "../musicsMode/modeMusic.js";

/** Faux <audio> : jsdom n'implémente pas la lecture média. */
const fakeAudio = () => ({ volume: 1 });

const mount = () => {
  document.body.innerHTML = `
    <button id="p5MuteBtn"><span id="p5MuteIcon">🔊</span></button>
    <div id="p5Volume"><div id="p5VolumeFill"></div></div>`;
  const track = document.getElementById("p5Volume");
  // jsdom rend tout en 0×0 — on fixe la géométrie pour pouvoir viser une position.
  track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 4 });
  return {
    track,
    fill: document.getElementById("p5VolumeFill"),
    muteBtn: document.getElementById("p5MuteBtn"),
    icon: document.getElementById("p5MuteIcon"),
  };
};

const pointerAt = (x) => new MouseEvent("pointerdown", { clientX: x, bubbles: true });

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("initVolumeControl", () => {
  it("démarre à fond quand rien n'est mémorisé", () => {
    const { fill } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    expect(audio.volume).toBe(1);
    expect(fill.style.width).toBe("100%");
  });

  it("restaure le volume mémorisé d'une visite à l'autre", () => {
    localStorage.setItem("musicVolume", "0.3");
    const { fill } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    expect(audio.volume).toBeCloseTo(0.3);
    expect(fill.style.width).toBe("30%");
  });

  it("ignore une valeur mémorisée corrompue ou hors bornes", () => {
    for (const bad of ["abc", "-1", "2", ""]) {
      localStorage.setItem("musicVolume", bad);
      mount();
      const audio = fakeAudio();
      initVolumeControl(audio);
      expect(audio.volume, `valeur "${bad}"`).toBe(1);
    }
  });

  it("règle le volume selon la position du clic", () => {
    const { track, fill } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    track.dispatchEvent(pointerAt(25));
    expect(audio.volume).toBeCloseTo(0.25);
    expect(fill.style.width).toBe("25%");
    expect(localStorage.getItem("musicVolume")).toBe("0.25");
  });

  it("borne le volume entre 0 et 1 hors de la piste", () => {
    const { track } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    track.dispatchEvent(pointerAt(-40));
    expect(audio.volume).toBe(0);
    track.dispatchEvent(pointerAt(999));
    expect(audio.volume).toBe(1);
  });

  it("le mute restaure le niveau précédent, il ne le perd pas", () => {
    const { track, muteBtn } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    track.dispatchEvent(pointerAt(40));
    expect(audio.volume).toBeCloseTo(0.4);

    muteBtn.click();
    expect(audio.volume).toBe(0);

    muteBtn.click();
    expect(audio.volume, "le niveau d'avant le mute doit revenir").toBeCloseTo(0.4);
  });

  it("un mute alors que le volume est déjà à 0 remonte à fond plutôt que de ne rien faire", () => {
    const { track, muteBtn } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    track.dispatchEvent(pointerAt(0));
    expect(audio.volume).toBe(0);
    muteBtn.click();
    expect(audio.volume).toBe(1);
  });

  it("l'icône suit le niveau", () => {
    const { track, icon } = mount();
    initVolumeControl(fakeAudio());
    expect(icon.textContent).toBe("🔊");
    track.dispatchEvent(pointerAt(30));
    expect(icon.textContent).toBe("🔉");
    track.dispatchEvent(pointerAt(0));
    expect(icon.textContent).toBe("🔇");
  });

  it("les flèches du clavier ajustent le volume par pas de 5 %", () => {
    const { track } = mount();
    const audio = fakeAudio();
    initVolumeControl(audio);
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(audio.volume).toBeCloseTo(0.95);
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(audio.volume).toBeCloseTo(1);
  });

  it("expose l'état au lecteur d'écran", () => {
    const { track } = mount();
    initVolumeControl(fakeAudio());
    track.dispatchEvent(pointerAt(60));
    expect(track.getAttribute("aria-valuenow")).toBe("60");
  });

  it("ne plante pas si le lecteur n'est pas dans le DOM", () => {
    document.body.innerHTML = "";
    expect(() => initVolumeControl(fakeAudio())).not.toThrow();
  });
});
