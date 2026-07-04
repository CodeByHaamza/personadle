/**
 * friends.test.js — Unit tests for the pure helpers in profile/friends/friends.js
 * (HTML escaping, avatar path resolution, online/last-seen formatting).
 * The friend-request business rules (duplicate/blocked) are tested server-side
 * in tests/php/FriendsTest.php.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { esc, avatarSrc, isOnline, formatLastSeen } from "../profile/friends/friends.js";

// ─────────────────────────────────────────────────────────────────────────────
// esc
// ─────────────────────────────────────────────────────────────────────────────

describe("esc", () => {
  it("escapes all HTML-special characters", () => {
    expect(esc(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;"
    );
  });

  it("returns an empty string for null/undefined", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("leaves a plain string untouched", () => {
    expect(esc("Joker42")).toBe("Joker42");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// avatarSrc
// ─────────────────────────────────────────────────────────────────────────────

describe("avatarSrc", () => {
  it("falls back to the default avatar when there is no data", () => {
    expect(avatarSrc(null)).toBe("../../img/default_avatar.png");
    expect(avatarSrc("")).toBe("../../img/default_avatar.png");
  });

  it("keeps a data: URL as-is", () => {
    const data = "data:image/png;base64,xyz";
    expect(avatarSrc(data)).toBe(data);
  });

  it("adjusts a ../img/ relative path for the friends/ subdirectory depth", () => {
    expect(avatarSrc("../img/avatar/joker.png")).toBe("../../img/avatar/joker.png");
  });

  it("adjusts a ./img/ relative path for the friends/ subdirectory depth", () => {
    expect(avatarSrc("./img/avatar/joker.png")).toBe("../../img/avatar/joker.png");
  });

  it("returns any other value untouched (already-absolute path)", () => {
    expect(avatarSrc("/img/avatar/joker.png")).toBe("/img/avatar/joker.png");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isOnline
// ─────────────────────────────────────────────────────────────────────────────

describe("isOnline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("returns false when lastSeen is null", () => {
    expect(isOnline(null)).toBe(false);
  });

  it("returns true when last seen less than 30 minutes ago", () => {
    expect(isOnline("2026-01-01T11:45:00Z")).toBe(true);
  });

  it("returns false when last seen exactly at the 30-minute threshold", () => {
    expect(isOnline("2026-01-01T11:30:00Z")).toBe(false);
  });

  it("returns false when last seen more than 30 minutes ago", () => {
    expect(isOnline("2026-01-01T10:00:00Z")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatLastSeen
// ─────────────────────────────────────────────────────────────────────────────

describe("formatLastSeen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("returns null when there is no date", () => {
    expect(formatLastSeen(null)).toBeNull();
  });

  it("reports seconds-scale gaps as 'just now'", () => {
    expect(formatLastSeen("2026-01-01T11:59:50Z")).toBe("just now");
  });

  it("reports minutes for a sub-hour gap", () => {
    expect(formatLastSeen("2026-01-01T11:55:00Z")).toBe("5m ago");
  });

  it("reports hours for a sub-day gap", () => {
    expect(formatLastSeen("2026-01-01T09:00:00Z")).toBe("3h ago");
  });

  it("reports days for a sub-week gap", () => {
    expect(formatLastSeen("2025-12-30T12:00:00Z")).toBe("2d ago");
  });

  it("falls back to 'a while ago' beyond a week", () => {
    expect(formatLastSeen("2025-12-01T12:00:00Z")).toBe("a while ago");
  });
});
