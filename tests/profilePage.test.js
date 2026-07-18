/**
 * profilePage.test.js — Unit tests for the pure helpers in profile/profile-page.js
 * (hex color math, streak tier thresholds, song time formatting, avatar path
 * normalization). This module does several `document.getElementById(...)` calls
 * (and a canvas 2d context lookup) at import time, so the DOM must exist and the
 * import must happen dynamically, after the DOM is populated.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

let hexToRgb, adjustHex, getStreakTier, formatSongTime, normalizeAvatarPath, _renderFriendCode;

beforeAll(async () => {
  // jsdom doesn't implement 2D canvas contexts — stub it to silence a noisy
  // "not implemented" console.error triggered by this module's top-level
  // `canvas.getContext("2d")` call.
  HTMLCanvasElement.prototype.getContext = () => null;

  document.body.innerHTML = `
    <div class="avatar-card-info">
      <img id="pageAvatar" /><span id="pageUsername"></span>
    </div>
    <input id="pseudoInput" />
    <button id="editAvatarBtn"></button><button id="saveAndRefreshBtn"></button>
    <button id="resetProfile"></button><button id="exportProfile"></button>
    <input id="borderColorPicker" /><div id="statsContainer"></div>
    <div id="avatarCropModal"></div><button id="closeCropper"></button>
    <div id="avatarGrid"></div><canvas id="avatarCanvas"></canvas>
    <button id="zoomIn"></button><button id="zoomOut"></button><button id="confirmCrop"></button>
  `;
  const mod = await import("../profile/profile-page.js");
  ({ hexToRgb, adjustHex, getStreakTier, formatSongTime, normalizeAvatarPath, _renderFriendCode } =
    mod);
});

// ─────────────────────────────────────────────────────────────────────────────
// hexToRgb
// ─────────────────────────────────────────────────────────────────────────────

describe("hexToRgb", () => {
  it("converts a hex color to an 'r, g, b' string", () => {
    expect(hexToRgb("#ff0000")).toBe("255, 0, 0");
    expect(hexToRgb("#00ff00")).toBe("0, 255, 0");
    expect(hexToRgb("#0000ff")).toBe("0, 0, 255");
  });

  it("works without a leading #", () => {
    expect(hexToRgb("ffffff")).toBe("255, 255, 255");
  });

  it("falls back to black for an invalid hex string", () => {
    expect(hexToRgb("not-a-color")).toBe("0, 0, 0");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adjustHex
// ─────────────────────────────────────────────────────────────────────────────

describe("adjustHex", () => {
  it("lightens a color with a positive delta", () => {
    expect(adjustHex("#808080", 10)).toBe("#8a8a8a");
  });

  it("darkens a color with a negative delta", () => {
    expect(adjustHex("#808080", -10)).toBe("#767676");
  });

  it("clamps at 255 (0xff) instead of overflowing", () => {
    expect(adjustHex("#fffefe", 10)).toBe("#ffffff");
  });

  it("clamps at 0 instead of underflowing", () => {
    expect(adjustHex("#000100", -10)).toBe("#000000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStreakTier
// ─────────────────────────────────────────────────────────────────────────────

describe("getStreakTier", () => {
  it("returns tier 0 for no streak", () => {
    expect(getStreakTier(0)).toBe(0);
  });

  it("returns the correct tier at each threshold boundary", () => {
    expect(getStreakTier(1)).toBe(1);
    expect(getStreakTier(2)).toBe(1);
    expect(getStreakTier(3)).toBe(2);
    expect(getStreakTier(6)).toBe(2);
    expect(getStreakTier(7)).toBe(3);
    expect(getStreakTier(13)).toBe(3);
    expect(getStreakTier(14)).toBe(4);
    expect(getStreakTier(29)).toBe(4);
    expect(getStreakTier(30)).toBe(5);
    expect(getStreakTier(365)).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatSongTime
// ─────────────────────────────────────────────────────────────────────────────

describe("formatSongTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatSongTime(65)).toBe("1:05");
    expect(formatSongTime(9)).toBe("0:09");
    expect(formatSongTime(600)).toBe("10:00");
  });

  it("returns 0:00 for negative or non-finite input", () => {
    expect(formatSongTime(-5)).toBe("0:00");
    expect(formatSongTime(NaN)).toBe("0:00");
    expect(formatSongTime(Infinity)).toBe("0:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeAvatarPath
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeAvatarPath", () => {
  it("falls back to the default avatar when there is no path", () => {
    expect(normalizeAvatarPath(null)).toBe("../img/default_avatar.png");
    expect(normalizeAvatarPath("")).toBe("../img/default_avatar.png");
  });

  it("keeps a data: URL as-is", () => {
    const data = "data:image/png;base64,xyz";
    expect(normalizeAvatarPath(data)).toBe(data);
  });

  it("keeps an absolute or http(s) path as-is", () => {
    expect(normalizeAvatarPath("/img/avatar/joker.png")).toBe("/img/avatar/joker.png");
    expect(normalizeAvatarPath("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  it("rewrites a legacy ./img/ path for the profile/ subdirectory depth", () => {
    expect(normalizeAvatarPath("./img/avatar/joker.png")).toBe("../img/avatar/joker.png");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _renderFriendCode
// ─────────────────────────────────────────────────────────────────────────────

describe("_renderFriendCode", () => {
  afterEach(() => {
    document.querySelector(".profile-friend-code")?.remove();
    delete window._currentUser;
    delete navigator.clipboard;
    vi.restoreAllMocks();
  });

  it("does nothing when there is no logged-in user", () => {
    _renderFriendCode();
    expect(document.querySelector(".profile-friend-code")).toBeNull();
  });

  it("creates a clickable button showing the friend code once logged in", () => {
    window._currentUser = { friend_code: "ABC12345" };
    _renderFriendCode();
    const el = document.querySelector(".profile-friend-code");
    expect(el.tagName).toBe("BUTTON");
    expect(el.querySelector(".pfc-code").textContent).toBe("ABC12345");
  });

  it("is idempotent — a second call reuses the same element instead of duplicating it", () => {
    window._currentUser = { friend_code: "ABC12345" };
    _renderFriendCode();
    _renderFriendCode();
    expect(document.querySelectorAll(".profile-friend-code")).toHaveLength(1);
  });

  it("updates the displayed code if it changes between calls (e.g. after cloud sync)", () => {
    window._currentUser = { friend_code: "ABC12345" };
    _renderFriendCode();
    window._currentUser = { friend_code: "ZZZ99999" };
    _renderFriendCode();
    expect(document.querySelector(".pfc-code").textContent).toBe("ZZZ99999");
  });

  it("removes the element on logout (no _currentUser)", () => {
    window._currentUser = { friend_code: "ABC12345" };
    _renderFriendCode();
    delete window._currentUser;
    _renderFriendCode();
    expect(document.querySelector(".profile-friend-code")).toBeNull();
  });

  it("copies the code to the clipboard and shows temporary 'Copied!' feedback on click", async () => {
    vi.useFakeTimers();
    window._currentUser = { friend_code: "ABC12345" };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    _renderFriendCode();

    const btn = document.querySelector(".profile-friend-code");
    btn.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("ABC12345"));

    expect(btn.classList.contains("copied")).toBe(true);
    expect(btn.querySelector(".pfc-code").textContent).toBe("Copied!");

    vi.advanceTimersByTime(1400);
    expect(btn.classList.contains("copied")).toBe(false);
    expect(btn.querySelector(".pfc-code").textContent).toBe("ABC12345");
    vi.useRealTimers();
  });

  it("falls back to document.execCommand when the Clipboard API is unavailable", async () => {
    window._currentUser = { friend_code: "ABC12345" };
    delete navigator.clipboard;
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    _renderFriendCode();

    document.querySelector(".profile-friend-code").click();
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });
});
