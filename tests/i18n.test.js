/**
 * i18n.test.js — Unit tests for js/i18n.js
 *
 * Strategy:
 *   - fetch() is stubbed globally with minimal EN + FR mock data.
 *   - Each test resets to English in beforeEach via setLang('en').
 *   - Module-level cache (_flatEN) is populated on the first setLang call
 *     and reused across tests — this matches real browser behavior.
 */

import { t, setLang, getCurrentLang, initLang } from "../js/i18n.js";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EN = {
  ui:      { submit: "Submit", title: "PersonaDLE" },
  game:    { win_message: "Found in {{count}} attempt(s)!", multi: "{{a}} and {{b}}" },
  only_en: { exclusive: "English only" },
};

const MOCK_FR = {
  ui:   { submit: "Valider", title: "PersonaDLE" },
  game: { win_message: "Trouvé en {{count}} essai(s) !" },
  // only_en is intentionally absent → must fallback to EN
};

function makeFetchStub() {
  return vi.fn(async (url) => {
    if (url.includes("en.json"))
      return { ok: true, json: async () => MOCK_EN };
    if (url.includes("fr.json"))
      return { ok: true, json: async () => MOCK_FR };
    return { ok: false, status: 404, json: async () => ({}) };
  });
}


// ─── Suite ────────────────────────────────────────────────────────────────────

describe("i18n", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", makeFetchStub());
  });

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = "";
    await setLang("en");
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });


  // ── t() ────────────────────────────────────────────────────────────────────

  describe("t()", () => {
    it("returns the correct translation for a known key", () => {
      expect(t("ui.submit")).toBe("Submit");
    });

    it("interpolates a single {{variable}} placeholder", () => {
      expect(t("game.win_message", { count: 3 })).toBe("Found in 3 attempt(s)!");
    });

    it("interpolates multiple {{variable}} placeholders", () => {
      expect(t("game.multi", { a: "X", b: "Y" })).toBe("X and Y");
    });

    it("leaves an unresolved {{var}} when the variable is not provided", () => {
      expect(t("game.win_message")).toContain("{{count}}");
    });

    it("returns the raw key for unknown keys", () => {
      expect(t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("returns the raw key for a deeply unknown nested key", () => {
      expect(t("a.b.c.d")).toBe("a.b.c.d");
    });
  });


  // ── getCurrentLang() ───────────────────────────────────────────────────────

  describe("getCurrentLang()", () => {
    it("returns 'en' after setLang('en')", () => {
      expect(getCurrentLang()).toBe("en");
    });

    it("returns 'fr' after setLang('fr')", async () => {
      await setLang("fr");
      expect(getCurrentLang()).toBe("fr");
    });

    it("resets back to 'en' when setLang('en') is called again", async () => {
      await setLang("fr");
      await setLang("en");
      expect(getCurrentLang()).toBe("en");
    });
  });


  // ── setLang() ──────────────────────────────────────────────────────────────

  describe("setLang()", () => {
    it("switches language — t() returns FR value after setLang('fr')", async () => {
      await setLang("fr");
      expect(t("ui.submit")).toBe("Valider");
    });

    it("falls back to EN for keys absent in the target language", async () => {
      await setLang("fr");
      expect(t("only_en.exclusive")).toBe("English only");
    });

    it("saves the requested lang code in localStorage", async () => {
      await setLang("fr");
      expect(localStorage.getItem("lang")).toBe("fr");
    });

    it("falls back to EN for unsupported lang codes and does not throw", async () => {
      await expect(setLang("xx")).resolves.not.toThrow();
      expect(getCurrentLang()).toBe("en");
    });

    it("sets document.documentElement.lang to the active language", async () => {
      await setLang("fr");
      expect(document.documentElement.lang).toBe("fr");
    });

    it("updates [data-i18n] textContent in the DOM", async () => {
      document.body.innerHTML = '<span data-i18n="ui.submit"></span>';
      await setLang("fr");
      expect(document.querySelector('[data-i18n="ui.submit"]').textContent).toBe("Valider");
    });

    it("updates [data-i18n-placeholder] in the DOM", async () => {
      document.body.innerHTML = '<input data-i18n-placeholder="ui.submit">';
      await setLang("fr");
      expect(document.querySelector("input").placeholder).toBe("Valider");
    });

    it("hides [data-i18n-block] elements for non-active languages", async () => {
      document.body.innerHTML = `
        <div data-i18n-block="en">EN block</div>
        <div data-i18n-block="fr">FR block</div>
      `;
      await setLang("fr");
      const enBlock = document.querySelector('[data-i18n-block="en"]');
      const frBlock = document.querySelector('[data-i18n-block="fr"]');
      expect(enBlock.style.display).toBe("none");
      expect(frBlock.style.display).toBe("");
    });
  });


  // ── initLang() ─────────────────────────────────────────────────────────────

  describe("initLang()", () => {
    it("uses the lang saved in localStorage when present", async () => {
      localStorage.setItem("lang", "fr");
      const lang = await initLang();
      expect(lang).toBe("fr");
      expect(t("ui.submit")).toBe("Valider");
    });

    it("ignores an unsupported saved lang and falls back to EN", async () => {
      localStorage.setItem("lang", "zz");
      const lang = await initLang();
      expect(lang).toBe("en");
    });

    it("returns the current language code", async () => {
      const lang = await initLang();
      expect(typeof lang).toBe("string");
      expect(["en", "fr", "es", "de"]).toContain(lang);
    });
  });
});
