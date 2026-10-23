/**
 * error_reporter.test.js — js/error_reporter.js (remontée des erreurs JS).
 *
 * Un rapporteur d'erreurs qui inonde le serveur ou en provoque lui-même est
 * pire que rien : on vérifie surtout ce qu'il NE fait PAS.
 */

import { describe, it, expect, vi } from "vitest";
import { buildReport, createReporter, describeRejection, isNoise } from "../js/error_reporter.js";

const err = (over = {}) => ({
  message: "TypeError: x is null",
  source: "https://personadle.net/js/gameCore.js",
  line: 12,
  col: 3,
  stack: "TypeError: x is null\n    at f (gameCore.js:12:3)",
  ...over,
});

describe("isNoise", () => {
  it("drops known noise", () => {
    expect(isNoise(err({ message: "Script error." }))).toBe(true);
    expect(isNoise(err({ message: "ResizeObserver loop limit exceeded" }))).toBe(true);
    expect(isNoise(err({ stack: "at x (chrome-extension://abc/c.js:1:1)" }))).toBe(true);
    expect(isNoise(err({ message: "TypeError: Failed to fetch" }))).toBe(true);
    expect(isNoise(err({ message: "" }))).toBe(true);
  });

  it("keeps real bugs", () => {
    expect(isNoise(err())).toBe(false);
  });
});

describe("createReporter", () => {
  it("sends each distinct error once", () => {
    const send = vi.fn();
    const report = createReporter({ send });
    report(err());
    report(err());
    report(err({ line: 99 }));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("caps the number of reports per page", () => {
    const send = vi.fn();
    const report = createReporter({ send });
    for (let i = 0; i < 20; i++) report(err({ line: i }));
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("never throws when sending fails", () => {
    const report = createReporter({
      send: () => {
        throw new Error("offline");
      },
    });
    expect(() => report(err())).not.toThrow();
  });
});

describe("buildReport", () => {
  it("keeps only the page path (no query string, no hash) and truncates", () => {
    const body = buildReport(err({ message: "x".repeat(900) }), {
      pathname: "/profile/profile.html",
      search: "?view=42",
      hash: "#token",
    });
    expect(body.page).toBe("/profile/profile.html");
    expect(body.message).toHaveLength(300);
    expect(JSON.stringify(body)).not.toContain("view=42");
  });
});

describe("describeRejection", () => {
  it("handles Errors, strings and plain objects", () => {
    expect(describeRejection(new RangeError("bad")).message).toBe("RangeError: bad");
    expect(describeRejection("nope").message).toBe("nope");
    expect(describeRejection({ status: 500 }).message).toContain('"status":500');
  });
});
