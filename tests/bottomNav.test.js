/**
 * bottomNav.test.js — Unit tests for the pure routing helpers in
 * js/bottomNav.js (previously 0% covered — nothing was exported).
 *
 * getCurrentPage/buildHrefs compute relative link depth from the current
 * URL — exactly the class of bug this project has already hit once for
 * real (pages/404.html's broken relative paths, cf. DEV_CHANGELOG.md
 * 2026-07-17). Worth locking down with tests. initBottomNav/updateNavAvatar
 * (DOM construction) are left untested, per this project's convention.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getCurrentPage, getProfileAvatar, buildHrefs } from "../js/bottomNav.js";

function setPath(path) {
  window.history.pushState({}, "", path);
}

beforeEach(() => {
  localStorage.clear();
  setPath("/");
});

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentPage
// ─────────────────────────────────────────────────────────────────────────────

describe("getCurrentPage", () => {
  it("recognizes the home page at the root", () => {
    setPath("/");
    expect(getCurrentPage()).toBe("home");
  });

  it("recognizes index.html as home", () => {
    setPath("/index.html");
    expect(getCurrentPage()).toBe("home");
  });

  it("recognizes the profile page", () => {
    setPath("/profile/profile.html");
    expect(getCurrentPage()).toBe("profile");
  });

  it("recognizes the friends page", () => {
    setPath("/profile/friends/friends.html");
    expect(getCurrentPage()).toBe("friends");
  });

  it("recognizes the leaderboard page", () => {
    setPath("/profile/leaderboard/leaderboard.html");
    expect(getCurrentPage()).toBe("leaderboard");
  });

  it.each([
    "/classiqueMode/classiqueMode.html",
    "/emojiMode/emojiMode.html",
    "/silhouetteMode/silhouette.html",
    "/allOutAttackMode/allOutAttack.html",
    "/personaeMode/personae.html",
    "/musicsMode/musics.html",
  ])("recognizes a game mode page (%s)", (path) => {
    setPath(path);
    expect(getCurrentPage()).toBe("game");
  });

  it("falls back to 'other' for an unrecognized page", () => {
    setPath("/pages/faq.html");
    expect(getCurrentPage()).toBe("other");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildHrefs — relative link depth per page location
// ─────────────────────────────────────────────────────────────────────────────

describe("buildHrefs", () => {
  it("uses './' depth from the site root (home)", () => {
    setPath("/index.html");
    const hrefs = buildHrefs("home");
    expect(hrefs.home).toBe("./index.html");
    expect(hrefs.profile).toBe("./profile/profile.html");
  });

  it("uses '../' depth from a 1-level page (profile, a game mode)", () => {
    setPath("/profile/profile.html");
    const hrefs = buildHrefs("profile");
    expect(hrefs.home).toBe("../index.html");
    expect(hrefs.friends).toBe("../profile/friends/friends.html");
  });

  it("uses '../../' depth from a 2-level page (friends, leaderboard)", () => {
    setPath("/profile/friends/friends.html");
    const hrefs = buildHrefs("friends");
    expect(hrefs.home).toBe("../../index.html");
    expect(hrefs.profile).toBe("../../profile/profile.html");
  });

  it("links to the same-page file directly when already on that section", () => {
    setPath("/profile/profile.html");
    expect(buildHrefs("profile").profile).toBe("./profile.html");

    setPath("/profile/friends/friends.html");
    expect(buildHrefs("friends").friends).toBe("./friends.html");

    setPath("/profile/leaderboard/leaderboard.html");
    expect(buildHrefs("leaderboard").leaderboard).toBe("./leaderboard.html");
  });

  it("uses '../' depth from a game mode subdirectory", () => {
    setPath("/classiqueMode/classiqueMode.html");
    const hrefs = buildHrefs("game");
    expect(hrefs.home).toBe("../index.html");
    expect(hrefs.leaderboard).toBe("../profile/leaderboard/leaderboard.html");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProfileAvatar
// ─────────────────────────────────────────────────────────────────────────────

describe("getProfileAvatar", () => {
  it("returns null when no profile is saved", () => {
    expect(getProfileAvatar("home")).toBeNull();
  });

  it("returns null when the saved profile has no avatar", () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({}));
    expect(getProfileAvatar("home")).toBeNull();
  });

  it("returns null instead of throwing on corrupted localStorage JSON", () => {
    localStorage.setItem("personaUserProfile", "{not valid json");
    expect(getProfileAvatar("home")).toBeNull();
  });

  it("returns a data: URL avatar unchanged", () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ avatar: "data:image/png;base64,abc123" })
    );
    expect(getProfileAvatar("home")).toBe("data:image/png;base64,abc123");
  });

  it("normalizes a relative img/ avatar path to an absolute one", () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ avatar: "img/avatar1.png" }));
    expect(getProfileAvatar("home")).toBe("/img/avatar1.png");
  });
});
