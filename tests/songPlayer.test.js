/**
 * songPlayer.test.js — Unit tests for profile/song-player.js
 * (extracted from profile-page.js's "PROFILE SONG" block).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSortedSongGroups, renderSongCard, selectProfileSong } from "../profile/song-player.js";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  // jsdom doesn't implement HTMLMediaElement playback — stub it so
  // initSongPlayer()'s autoplay attempt doesn't throw/log "Not implemented".
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

describe("getSortedSongGroups", () => {
  it("groups every song under a known opus key", () => {
    const groups = getSortedSongGroups();
    const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
    // Every song from the database must land in exactly one group.
    expect(total).toBeGreaterThan(0);
  });

  it("sorts songs alphabetically by title within each group", () => {
    const groups = getSortedSongGroups();
    for (const list of Object.values(groups)) {
      const titles = list.map((s) => s.titre);
      const sorted = [...titles].sort((a, b) => a.localeCompare(b));
      expect(titles).toEqual(sorted);
    }
  });
});

describe("renderSongCard", () => {
  it("is a no-op when #songCard is absent", () => {
    expect(() =>
      renderSongCard({}, vi.fn(), vi.fn(), vi.fn())
    ).not.toThrow();
  });

  it("shows the 'choose music' button when no song is set", () => {
    document.body.innerHTML = `<div id="songCard"></div>`;
    renderSongCard({}, vi.fn(), vi.fn(), vi.fn());
    expect(document.getElementById("openSongModal")).not.toBeNull();
    expect(document.getElementById("songPlayerUI")).toBeNull();
  });

  it("shows the mini-player when a song is set", () => {
    document.body.innerHTML = `<div id="songCard"></div>`;
    renderSongCard(
      { profileSong: { fichier: "test.mp3", titre: "Test Song", opus: ["P5"], image: "p5.webp" } },
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    expect(document.getElementById("songPlayerUI")).not.toBeNull();
    expect(document.getElementById("openSongModal")).toBeNull();
  });
});

describe("selectProfileSong", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="songCard"></div>`;
  });

  it("is a no-op for an unknown filename", () => {
    const profile = {};
    const saveProfile = vi.fn();
    selectProfileSong("not_a_real_file.mp3", profile, saveProfile, vi.fn(), vi.fn());
    expect(profile.profileSong).toBeUndefined();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("sets profile.profileSong, saves, and pushes to the cloud for a known song", () => {
    const [anySong] = Object.values(getSortedSongGroups()).flat();
    const profile = {};
    const saveProfile = vi.fn();
    const saveProfileToCloud = vi.fn();
    const markDirty = vi.fn();

    selectProfileSong(anySong.fichier, profile, saveProfile, saveProfileToCloud, markDirty);

    expect(profile.profileSong.fichier).toBe(anySong.fichier);
    expect(saveProfile).toHaveBeenCalledOnce();
    expect(markDirty).toHaveBeenCalledOnce();
    expect(saveProfileToCloud).toHaveBeenCalledWith({ profile_music_id: anySong.fichier });
  });
});
