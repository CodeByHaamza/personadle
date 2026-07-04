/**
 * shareCard.test.js — Unit tests for profile/share-card.js
 * (extracted from profile-page.js's "PARTAGE DE PROFIL" block).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setupShareProfile,
  setupCopyProfileLink,
  attachPreviewClicksToImages,
  refreshShareCardPreview,
} from "../profile/share-card.js";

const SHARE_MODAL_HTML = `
  <button id="shareProfileBtn"></button>
  <div id="sharePreviewModal" class="hidden">
    <button id="closeSharePreview"></button>
    <div id="sharePreviewArea"></div>
    <button id="downloadProfileBtn"></button>
    <button id="shareTwitterBtn"></button>
    <button id="shareDiscordBtn"></button>
    <button id="shareEmailBtn"></button>
    <div id="backgroundSelector"></div>
  </div>
`;

function makeProfile(overrides = {}) {
  return {
    pseudo: "Joker",
    avatar: "joker.png",
    avatarBorderColor: "#ffd700",
    stats: { wins: 10, streakRecord: 5 },
    badges: ["a", "b"],
    selectedBadges: [],
    hasSharedProfile: false,
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  window.html2canvas = vi.fn().mockResolvedValue({ toDataURL: () => "data:image/png;base64,x" });
  delete window._currentUser;
});

describe("setupShareProfile", () => {
  it("is a no-op when the share button/modal are absent", () => {
    expect(() => setupShareProfile(makeProfile(), vi.fn())).not.toThrow();
  });

  it("renders the share card preview into #sharePreviewArea when the button is clicked", async () => {
    document.body.innerHTML = SHARE_MODAL_HTML;
    setupShareProfile(makeProfile(), vi.fn());

    document.getElementById("shareProfileBtn").click();

    const modal = document.getElementById("sharePreviewModal");
    expect(modal.classList.contains("hidden")).toBe(false);
    const card = document.querySelector("#sharePreviewArea #shareCard");
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Joker");

    // Let generatePreview()'s internal setTimeout(html2canvas capture) settle
    // before the DOM is torn down by the next test's beforeEach.
    await new Promise((r) => setTimeout(r, 150));
  });

  it("closes the modal via the close button", async () => {
    document.body.innerHTML = SHARE_MODAL_HTML;
    setupShareProfile(makeProfile(), vi.fn());
    document.getElementById("shareProfileBtn").click();
    document.getElementById("closeSharePreview").click();
    expect(document.getElementById("sharePreviewModal").classList.contains("hidden")).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
  });
});

describe("refreshShareCardPreview", () => {
  it("is a no-op when no share modal exists", () => {
    expect(() => refreshShareCardPreview()).not.toThrow();
  });

  it("is a no-op when the share modal is hidden", () => {
    document.body.innerHTML = SHARE_MODAL_HTML;
    setupShareProfile(makeProfile(), vi.fn());
    expect(() => refreshShareCardPreview()).not.toThrow();
    // Preview area stays empty since the modal was never opened.
    expect(document.getElementById("sharePreviewArea").children.length).toBe(0);
  });

  it("regenerates the preview when the share modal is open", async () => {
    document.body.innerHTML = SHARE_MODAL_HTML;
    setupShareProfile(makeProfile(), vi.fn());
    document.getElementById("shareProfileBtn").click(); // opens + first render
    document.getElementById("sharePreviewArea").innerHTML = ""; // simulate stale preview
    refreshShareCardPreview();
    expect(document.querySelector("#sharePreviewArea #shareCard")).not.toBeNull();
    await new Promise((r) => setTimeout(r, 150));
  });
});

describe("setupCopyProfileLink", () => {
  it("is a no-op when #copyProfileLinkBtn is absent", () => {
    expect(() => setupCopyProfileLink()).not.toThrow();
  });

  it("stays hidden without a logged-in friend_code", () => {
    document.body.innerHTML = `<button id="copyProfileLinkBtn" style="display:none"></button>`;
    setupCopyProfileLink();
    expect(document.getElementById("copyProfileLinkBtn").style.display).toBe("none");
  });

  it("reveals the button once auth resolves with a friend_code", () => {
    document.body.innerHTML = `<button id="copyProfileLinkBtn" style="display:none"></button>`;
    setupCopyProfileLink();
    window._currentUser = { friend_code: "ABC123" };
    window.dispatchEvent(new Event("personadle:auth-ready"));
    expect(document.getElementById("copyProfileLinkBtn").style.display).toBe("");
  });

  it("copies the profile URL to the clipboard on click", async () => {
    document.body.innerHTML = `
      <button id="copyProfileLinkBtn" style="display:none"></button>
      <span id="shareStatus"></span>
    `;
    window._currentUser = { friend_code: "ABC123" };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setupCopyProfileLink();

    document.getElementById("copyProfileLinkBtn").click();
    await new Promise((r) => setTimeout(r, 0));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("view=ABC123"));
  });
});

describe("attachPreviewClicksToImages", () => {
  it("is a no-op when #previewBadges is absent", () => {
    expect(() => attachPreviewClicksToImages()).not.toThrow();
  });

  it("opens a badge zoom modal when a preview image is clicked", async () => {
    document.body.innerHTML = `
      <div id="previewBadges">
        <img class="badge-preview-img" data-badge-id="ace_detective">
      </div>
    `;
    attachPreviewClicksToImages();
    document.querySelector(".badge-preview-img").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(".badge-zoom-modal")).not.toBeNull();
  });
});
