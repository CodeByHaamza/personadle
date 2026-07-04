/**
 * autocomplete.test.js — Unit tests for js/autocomplete.js
 * (extracted from classiqueMode/modeClassique.js, emojiMode/emojiMode.js and
 * allOutAttackMode/modeAllOutAttack.js, where these two functions were
 * byte-for-byte duplicated three times).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { closeAutocompleteList, removeFromAutocomplete } from "../js/autocomplete.js";

describe("closeAutocompleteList", () => {
  let input;

  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input id="guessInput" />
        <div class="autocomplete-items"></div>
        <div class="autocomplete-items"></div>
      </div>
    `;
    input = document.getElementById("guessInput");
  });

  it("removes every .autocomplete-items element when called with null", () => {
    closeAutocompleteList(null, input);
    expect(document.getElementsByClassName("autocomplete-items")).toHaveLength(0);
  });

  it("preserves the list belonging to the given input element", () => {
    // e === inputElement → nothing should be removed
    closeAutocompleteList(input, input);
    expect(document.getElementsByClassName("autocomplete-items")).toHaveLength(2);
  });

  it("preserves an item when it is itself the click target (e === item)", () => {
    const item = document.querySelectorAll(".autocomplete-items")[0];
    closeAutocompleteList(item, input);
    expect(document.getElementsByClassName("autocomplete-items")).toHaveLength(1);
    expect(document.body.contains(item)).toBe(true);
  });

  it("is a no-op when there are no open lists", () => {
    document.body.innerHTML = `<input id="guessInput" />`;
    expect(() => closeAutocompleteList(null, document.getElementById("guessInput"))).not.toThrow();
  });
});

describe("removeFromAutocomplete", () => {
  it("removes a matching name (case-insensitive) from the array", () => {
    const pool = ["Joker", "Ryuji", "Ann"];
    removeFromAutocomplete(pool, "ryuji");
    expect(pool).toEqual(["Joker", "Ann"]);
  });

  it("mutates the array in place (same reference)", () => {
    const pool = ["Joker", "Ryuji"];
    const ref = pool;
    removeFromAutocomplete(pool, "Joker");
    expect(ref).toBe(pool);
    expect(ref).toEqual(["Ryuji"]);
  });

  it("is a no-op when the name is not found", () => {
    const pool = ["Joker", "Ryuji"];
    removeFromAutocomplete(pool, "Morgana");
    expect(pool).toEqual(["Joker", "Ryuji"]);
  });

  it("removes only the first match when duplicates exist", () => {
    const pool = ["Joker", "Joker", "Ryuji"];
    removeFromAutocomplete(pool, "Joker");
    expect(pool).toEqual(["Joker", "Ryuji"]);
  });
});
