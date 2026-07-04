/**
 * langSelector.test.js — Unit tests for js/lang-selector.js
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { initLangSelector } from "../js/lang-selector.js";

const MOCK_EN = { ui: { submit: "Submit" } };
const MOCK_FR = { ui: { submit: "Valider" } };

function makeFetchStub() {
  return vi.fn(async (url) => {
    if (url.includes("en.json")) return { ok: true, json: async () => MOCK_EN };
    if (url.includes("fr.json")) return { ok: true, json: async () => MOCK_FR };
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

describe("initLangSelector", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", makeFetchStub());
  });

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to initLang() when the mount element is absent", async () => {
    const lang = await initLangSelector();
    expect(lang).toBe("en");
  });

  it("injects the dropdown markup into the mount element", async () => {
    document.body.innerHTML = `<div id="langSelectorMount"></div>`;
    await initLangSelector();

    expect(document.getElementById("langBtn")).not.toBeNull();
    expect(document.getElementById("langDropdown")).not.toBeNull();
    expect(document.querySelectorAll(".lang-opt")).toHaveLength(5);
    expect(document.getElementById("langBtnLabel").textContent).toBe("EN");
  });

  it("opens and closes the dropdown when the button is clicked", async () => {
    document.body.innerHTML = `<div id="langSelectorMount"></div>`;
    await initLangSelector();

    const toggle = document.getElementById("langToggle");
    document.getElementById("langBtn").click();
    expect(toggle.classList.contains("open")).toBe(true);

    document.getElementById("langBtn").click();
    expect(toggle.classList.contains("open")).toBe(false);
  });

  it("switches language and updates the label when an option is clicked", async () => {
    document.body.innerHTML = `<div id="langSelectorMount"></div>`;
    await initLangSelector();

    document.querySelector('.lang-opt[data-lang="fr"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById("langBtnLabel").textContent).toBe("FR");
    expect(document.querySelector('.lang-opt[data-lang="fr"]').classList.contains("is-active")).toBe(
      true
    );
    expect(localStorage.getItem("lang")).toBe("fr");
  });

  it("closes the dropdown on outside click", async () => {
    document.body.innerHTML = `<div id="langSelectorMount"></div>`;
    await initLangSelector();

    document.getElementById("langBtn").click();
    expect(document.getElementById("langToggle").classList.contains("open")).toBe(true);

    document.body.click();
    expect(document.getElementById("langToggle").classList.contains("open")).toBe(false);
  });
});
