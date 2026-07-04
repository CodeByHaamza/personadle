/**
 * modal.test.js — Unit tests for js/modal.js (shared accessible modal helper).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { openModal, closeModal } from "../js/modal.js";

function makeModal(id, innerHTML) {
  const el = document.createElement("div");
  el.id = id;
  el.className = "hidden";
  el.innerHTML = innerHTML;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  // jsdom doesn't implement layout — offsetParent is always null there, even
  // for elements that would be visible in a real browser. Stub it so the
  // trap's visibility filter (x.offsetParent !== null) behaves as it would
  // in production.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});

describe("openModal", () => {
  it("is a no-op when the target element doesn't exist", () => {
    expect(() => openModal("missingModal")).not.toThrow();
  });

  it("removes the hidden class and sets dialog ARIA attributes", () => {
    makeModal("m1", `<button id="a">A</button>`);
    openModal("m1");
    const el = document.getElementById("m1");
    expect(el.classList.contains("hidden")).toBe(false);
    expect(el.getAttribute("role")).toBe("dialog");
    expect(el.getAttribute("aria-modal")).toBe("true");
    closeModal("m1");
  });

  it("focuses the first focusable element", () => {
    makeModal("m1", `<button id="first">First</button><button id="second">Second</button>`);
    openModal("m1");
    expect(document.activeElement.id).toBe("first");
    closeModal("m1");
  });
});

describe("closeModal", () => {
  it("is a no-op when the modal was never opened", () => {
    makeModal("m1", `<button>A</button>`);
    expect(() => closeModal("m1")).not.toThrow();
  });

  it("re-adds the hidden class", () => {
    makeModal("m1", `<button id="a">A</button>`);
    openModal("m1");
    closeModal("m1");
    expect(document.getElementById("m1").classList.contains("hidden")).toBe(true);
  });

  it("restores focus to the element that had it before opening", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    makeModal("m1", `<button id="a">A</button>`);
    openModal("m1");
    expect(document.activeElement.id).toBe("a");

    closeModal("m1");
    expect(document.activeElement.id).toBe("trigger");
  });
});

describe("keyboard trap", () => {
  it("closes the modal and restores focus on Escape", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    makeModal("m1", `<button id="a">A</button>`);
    openModal("m1");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(document.getElementById("m1").classList.contains("hidden")).toBe(true);
    expect(document.activeElement.id).toBe("trigger");
  });

  it("calls the onClose callback on Escape", () => {
    makeModal("m1", `<button id="a">A</button>`);
    const onClose = vi.fn();
    openModal("m1", { onClose });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("wraps Tab from the last focusable to the first", () => {
    makeModal("m1", `<button id="a">A</button><button id="b">B</button>`);
    openModal("m1");
    document.getElementById("b").focus();

    const evt = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(evt);

    expect(document.activeElement.id).toBe("a");
    closeModal("m1");
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    makeModal("m1", `<button id="a">A</button><button id="b">B</button>`);
    openModal("m1");
    document.getElementById("a").focus();

    const evt = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(evt);

    expect(document.activeElement.id).toBe("b");
    closeModal("m1");
  });

  it("stops reacting to keydown after the modal is closed", () => {
    makeModal("m1", `<button id="a">A</button><button id="b">B</button>`);
    openModal("m1");
    closeModal("m1");

    // A stray Escape after close should not throw or affect anything further.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    ).not.toThrow();
  });
});

describe("multiple independent modals", () => {
  it("keeps separate focus-restore state per modal id", () => {
    const trigger1 = document.createElement("button");
    trigger1.id = "trigger1";
    document.body.appendChild(trigger1);

    makeModal("m1", `<button id="a">A</button>`);
    makeModal("m2", `<button id="c">C</button>`);

    trigger1.focus();
    openModal("m1");
    openModal("m2"); // opened while m1's trap is still active

    closeModal("m2");
    expect(document.activeElement.id).toBe("a"); // back to m1's first focusable

    closeModal("m1");
    expect(document.activeElement.id).toBe("trigger1");
  });

  it("does not leak a keydown listener when opened twice for the same id without closing in between", () => {
    makeModal("m1", `<button id="a">A</button>`);
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    openModal("m1");
    openModal("m1"); // re-open without an intervening closeModal("m1")
    closeModal("m1");

    const keydownAdds = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
    const keydownRemoves = removeSpy.mock.calls.filter(([type]) => type === "keydown").length;
    expect(keydownAdds).toBe(2);
    expect(keydownRemoves).toBe(2); // the stale listener from the first open must also be removed
  });
});
