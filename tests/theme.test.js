/**
 * theme.test.js — Unit tests for profile/theme.js
 * (extracted from profile-page.js's THEMES/applyTheme, which profile-view.js
 * also duplicated verbatim as PROFILE_THEMES/applyViewTheme — the comment
 * in profile-view.js literally said "identiques à profile-page.js").
 */

import { describe, it, expect, beforeEach } from "vitest";
import { THEME_COLORS, hexToRgb, adjustHex, resolveTheme, applyThemeVars } from "../profile/theme.js";

describe("hexToRgb", () => {
  it("converts a hex color to an 'r, g, b' string", () => {
    expect(hexToRgb("#ff0000")).toBe("255, 0, 0");
  });

  it("falls back to black for an invalid hex string", () => {
    expect(hexToRgb("not-a-color")).toBe("0, 0, 0");
  });
});

describe("adjustHex", () => {
  it("lightens and darkens a color", () => {
    expect(adjustHex("#808080", 10)).toBe("#8a8a8a");
    expect(adjustHex("#808080", -10)).toBe("#767676");
  });

  it("clamps at the 0x00-0xff bounds", () => {
    expect(adjustHex("#fffefe", 10)).toBe("#ffffff");
    expect(adjustHex("#000100", -10)).toBe("#000000");
  });
});

describe("resolveTheme", () => {
  it("resolves a built-in theme id to its THEME_COLORS entry", () => {
    expect(resolveTheme("all_out")).toEqual(THEME_COLORS.all_out);
    expect(resolveTheme("velvet_room")).toEqual(THEME_COLORS.velvet_room);
  });

  it("resolves 'custom' + a hex color into computed hover/light/rgb", () => {
    const result = resolveTheme("custom", "#e63946");
    expect(result.accent).toBe("#e63946");
    expect(result.hover).toBe(adjustHex("#e63946", -35));
    expect(result.light).toBe(adjustHex("#e63946", 45));
    expect(result.rgb).toBe(hexToRgb("#e63946"));
  });

  it("returns null for 'custom' without a color", () => {
    expect(resolveTheme("custom")).toBeNull();
  });

  it("returns null for an unknown theme id", () => {
    expect(resolveTheme("not_a_real_theme")).toBeNull();
  });
});

describe("applyThemeVars", () => {
  beforeEach(() => {
    document.documentElement.style.cssText = "";
  });

  it("sets the 4 CSS custom properties on <html>", () => {
    applyThemeVars({ accent: "#111111", hover: "#222222", light: "#333333", rgb: "1, 2, 3" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--accent")).toBe("#111111");
    expect(root.style.getPropertyValue("--accent-hover")).toBe("#222222");
    expect(root.style.getPropertyValue("--accent-light")).toBe("#333333");
    expect(root.style.getPropertyValue("--accent-rgb")).toBe("1, 2, 3");
  });

  it("is a no-op when vars is null (e.g. unresolved theme)", () => {
    applyThemeVars(null);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });
});
