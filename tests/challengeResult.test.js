/**
 * challengeResult.test.js — Unit tests for checkChallengeCompletion()
 * (js/challenge-result.js), previously 0% covered.
 *
 * Focuses on the decision logic that runs BEFORE the celebratory overlay is
 * rendered — success/fail computation against the challenge's target score,
 * the message-status update sent to the server, and the localStorage
 * cleanup/restoration around a completed challenge. Deliberately does not
 * assert on the overlay's visual details (pure DOM/animation, out of scope
 * per this project's testing convention) beyond the minimum needed to prove
 * xpGained flows through correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkChallengeCompletion } from "../js/challenge-result.js";

function activeChallenge(overrides = {}) {
  return {
    msgId: 1,
    mode: "classic",
    date: "2026-07-20",
    score: 3,
    senderId: 7,
    filterKey: null,
    originalFilters: null,
    target: null,
    ...overrides,
  };
}

/** Full API mock — checkChallengeCompletion always fetches sender/SL/own-profile when senderId is set. */
function mockApi({ updateStatus = vi.fn().mockResolvedValue({}) } = {}) {
  return {
    messages: { updateStatus },
    user: { get: vi.fn().mockResolvedValue(null) },
    socialLink: {
      getByFriend: vi.fn().mockRejectedValue(new Error("n/a")),
      get: vi.fn(),
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  document.documentElement.lang = "en";
  window._currentUser = { id: 1, pseudo: "Me" };
  if (!window.requestAnimationFrame) {
    vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(cb, 0));
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window._currentUser;
  delete window._personadleApi;
  document.body.innerHTML = "";
});

describe("checkChallengeCompletion — early returns", () => {
  it("is a no-op when there is no active challenge", async () => {
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 2, true);

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(document.getElementById("cr-overlay")).toBeNull();
  });

  it("ignores a challenge for a different mode and leaves it untouched", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ mode: "music" })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 2, true);

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(localStorage.getItem("activeChallenge")).not.toBeNull();
  });

  it("matches the mode case-insensitively", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ mode: "Classic" })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 2, true);

    expect(api.messages.updateStatus).toHaveBeenCalled();
  });

  it("does not throw and is a no-op on malformed JSON", async () => {
    localStorage.setItem("activeChallenge", "{not valid json");
    const api = mockApi();
    window._personadleApi = api;

    await expect(checkChallengeCompletion("classic", 2, true)).resolves.toBeUndefined();
    expect(api.messages.updateStatus).not.toHaveBeenCalled();
  });
});

describe("checkChallengeCompletion — success/fail computation", () => {
  it("counts as beaten when the player won within the challenge's score", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 3 })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 2, true);

    expect(api.messages.updateStatus).toHaveBeenCalledWith(1, "beaten");
  });

  it("counts as beaten when attempts exactly equal the challenge's score", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 3 })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 3, true);

    expect(api.messages.updateStatus).toHaveBeenCalledWith(1, "beaten");
  });

  it("counts as expired when the player won but used more attempts than the target score", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 3 })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 4, true);

    expect(api.messages.updateStatus).toHaveBeenCalledWith(1, "expired");
  });

  it("counts as expired when the player gave up (isWin false), regardless of attempts", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 5 })));
    const api = mockApi();
    window._personadleApi = api;

    await checkChallengeCompletion("classic", 1, false);

    expect(api.messages.updateStatus).toHaveBeenCalledWith(1, "expired");
  });

  it("does not let a failed status update block the rest of the flow", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge()));
    window._personadleApi = mockApi({
      updateStatus: vi.fn().mockRejectedValue(new Error("network")),
    });

    await expect(checkChallengeCompletion("classic", 2, true)).resolves.toBeUndefined();
    expect(document.getElementById("cr-overlay")).not.toBeNull();
  });
});

describe("checkChallengeCompletion — localStorage cleanup", () => {
  it("consumes the active challenge (removes it) once processed", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge()));
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 2, true);

    expect(localStorage.getItem("activeChallenge")).toBeNull();
  });

  it("restores the original opus filters when the challenge had backed them up", async () => {
    localStorage.setItem("filters_classic", JSON.stringify(["P5"]));
    localStorage.setItem(
      "activeChallenge",
      JSON.stringify(
        activeChallenge({ filterKey: "filters_classic", originalFilters: '["P3","P4"]' })
      )
    );
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 2, true);

    expect(localStorage.getItem("filters_classic")).toBe('["P3","P4"]');
  });

  it("clears the mode's game-state keys when the challenge had a dedicated target", async () => {
    localStorage.setItem("target", JSON.stringify({ nom: "Joker" }));
    localStorage.setItem("attempts", "2");
    localStorage.setItem(
      "activeChallenge",
      JSON.stringify(activeChallenge({ target: "Joker" }))
    );
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 2, true);

    expect(localStorage.getItem("target")).toBeNull();
    expect(localStorage.getItem("attempts")).toBeNull();
  });

  it("leaves the mode's game-state keys untouched for an old-format challenge without a target", async () => {
    localStorage.setItem("target", JSON.stringify({ nom: "Joker" }));
    localStorage.setItem(
      "activeChallenge",
      JSON.stringify(activeChallenge({ target: null }))
    );
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 2, true);

    expect(localStorage.getItem("target")).not.toBeNull();
  });
});

describe("checkChallengeCompletion — result overlay", () => {
  it("shows the XP-gained line on a beaten challenge", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 3 })));
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 2, true);

    expect(document.querySelector(".cr-modal-xp")).not.toBeNull();
  });

  it("shows no XP-gained line on an expired/failed challenge", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(activeChallenge({ score: 1 })));
    window._personadleApi = mockApi();

    await checkChallengeCompletion("classic", 5, true);

    expect(document.querySelector(".cr-modal-xp")).toBeNull();
  });
});
