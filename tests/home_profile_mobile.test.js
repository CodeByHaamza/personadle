/**
 * home_profile_mobile.test.js — js/home_mobile.js et profile/profile_mobile.js.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHomeStatusBadges, dockQuickActions } from "../js/home_mobile.js";
import { applyCollapsible, findCollapsibleCards } from "../profile/profile_mobile.js";

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

const progress = (doneKeys) => ({
  done: doneKeys.length,
  total: 6,
  modes: ["classic", "emoji", "silhouette", "alloutattack", "personae", "music"].map((key) => ({
    key,
    label: key,
    done: doneKeys.includes(key),
  })),
});

describe("renderHomeStatusBadges", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="gameModeSelector">
      <button id="classicButton"></button><button id="EmojiButton"></button>
      <button id="ShadowsButton"></button><button id="AllOutAttackButton"></button>
      <button id="PersonaeButton"></button><button id="MusicButton"></button></div>`;
  });

  it("puts a check on the banners of the modes played today", () => {
    renderHomeStatusBadges(progress(["classic", "silhouette"]));
    expect(document.querySelector("#classicButton .mode-status-badge")).not.toBeNull();
    expect(document.querySelector("#ShadowsButton .mode-status-badge")).not.toBeNull();
    expect(document.querySelectorAll(".mode-status-badge")).toHaveLength(2);
  });

  it("does not stack badges and removes them on a new day", () => {
    renderHomeStatusBadges(progress(["classic"]));
    renderHomeStatusBadges(progress(["classic"]));
    expect(document.querySelectorAll("#classicButton .mode-status-badge")).toHaveLength(1);
    renderHomeStatusBadges(progress([]));
    expect(document.querySelectorAll(".mode-status-badge")).toHaveLength(0);
  });
});

describe("dockQuickActions", () => {
  it("moves News and Daily Reset under the title, keeping their listeners", () => {
    document.body.innerHTML = `<section class="title-wrapper"></section>
      <div id="gameModeSelector"></div>
      <button id="newsBtn"></button><button id="dailyInfoBtn"></button>`;
    let clicks = 0;
    document.getElementById("newsBtn").addEventListener("click", () => clicks++);
    dockQuickActions();
    dockQuickActions(); // idempotent
    const row = document.getElementById("homeQuickActions");
    expect(row.previousElementSibling.className).toBe("title-wrapper");
    expect([...row.children].map((b) => b.id)).toEqual(["newsBtn", "dailyInfoBtn"]);
    document.getElementById("newsBtn").click();
    expect(clicks).toBe(1);
  });
});

describe("profile collapsible cards", () => {
  const card = (key) =>
    `<div class="profile-card"><h3 class="card-title"><span data-i18n="${key}">T</span></h3><p>body</p></div>`;

  beforeEach(() => {
    document.body.innerHTML =
      card("profile.stats_title") +
      card("profile.badges_title") +
      card("profile.event_code_title") +
      card("profile.share_title");
  });

  it("never makes the statistics collapsible", () => {
    const keys = findCollapsibleCards().map((c) => c.key);
    expect(keys).not.toContain("profile.stats_title");
    expect(keys).toEqual([
      "profile.badges_title",
      "profile.event_code_title",
      "profile.share_title",
    ]);
  });

  it("applies the defaults, toggles on tap and remembers the choice", () => {
    applyCollapsible(true);
    const [badges, event] = findCollapsibleCards().map((c) => c.card);
    expect(badges.classList.contains("is-collapsed")).toBe(false);
    expect(event.classList.contains("is-collapsed")).toBe(true);
    expect(event.querySelector(".card-title").getAttribute("aria-expanded")).toBe("false");

    event.querySelector(".card-title").click();
    expect(event.classList.contains("is-collapsed")).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("profileCardsCollapsed"))["profile.event_code_title"]
    ).toBe(false);
  });

  it("opens with the keyboard (Enter)", () => {
    applyCollapsible(true);
    const event = findCollapsibleCards()[1].card;
    event
      .querySelector(".card-title")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(event.classList.contains("is-collapsed")).toBe(false);
  });

  it("restores everything above 480 px", () => {
    applyCollapsible(true);
    applyCollapsible(false);
    for (const { card: c } of findCollapsibleCards()) {
      expect(c.classList.contains("is-collapsible")).toBe(false);
      expect(c.classList.contains("is-collapsed")).toBe(false);
      expect(c.querySelector(".card-title").hasAttribute("role")).toBe(false);
    }
  });
});
