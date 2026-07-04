/**
 * auth.test.js — Unit tests for the pure error-resolution helpers in js/auth.js.
 * (resolveLoginError / resolveRegisterError — the rest of auth.js is DOM+network
 * orchestration, covered manually/via E2E rather than unit tests.)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveLoginError, resolveRegisterError } from "../js/auth.js";

const TRANSLATIONS = {
  "auth.error_missing_fields": "Email (ou pseudo) et mot de passe requis.",
  "auth.error_wrong_credentials": "Email ou mot de passe incorrect.",
  "auth.error_banned": "Compte banni.",
  "auth.error_invalid_email": "Adresse email invalide.",
  "auth.error_pseudo_length": "Le pseudo doit faire entre 3 et 50 caractères.",
  "auth.error_pseudo_chars": "Caractères interdits dans le pseudo.",
  "auth.error_password_length": "Mot de passe trop court.",
  "auth.error_email_taken": "Email déjà utilisé.",
  "auth.error_pseudo_taken": "Pseudo déjà pris.",
  "auth.error_generic": "Une erreur est survenue.",
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.i18n = { t: (key) => TRANSLATIONS[key] ?? key };
});

describe("resolveLoginError", () => {
  it("maps a known backend message to its translation", () => {
    expect(resolveLoginError("Invalid email or password")).toBe("Email ou mot de passe incorrect.");
  });

  it("maps the banned-account message", () => {
    expect(
      resolveLoginError("Account banned. Contact support if you think this is an error.")
    ).toBe("Compte banni.");
  });

  it("falls back to the raw message for an unmapped backend error", () => {
    expect(resolveLoginError("Something totally unexpected")).toBe("Something totally unexpected");
  });

  it("falls back to the generic translated message when no message is given", () => {
    expect(resolveLoginError(undefined)).toBe("Une erreur est survenue.");
  });

  it("falls back to an English default when i18n isn't ready", () => {
    window.i18n = undefined;
    expect(resolveLoginError(undefined)).toBe("Login failed");
  });
});

describe("resolveRegisterError", () => {
  it("maps 'email already registered' to the existing auth.error_email_taken key", () => {
    expect(resolveRegisterError("This email is already registered")).toBe("Email déjà utilisé.");
  });

  it("maps 'username already taken' to the existing auth.error_pseudo_taken key", () => {
    expect(resolveRegisterError("This username is already taken")).toBe("Pseudo déjà pris.");
  });

  it("maps password-too-short from the backend validator", () => {
    expect(resolveRegisterError("Password must be at least 8 characters")).toBe(
      "Mot de passe trop court."
    );
  });

  it("maps pseudo length/charset validation errors", () => {
    expect(resolveRegisterError("Username must be between 3 and 50 characters")).toBe(
      "Le pseudo doit faire entre 3 et 50 caractères."
    );
    expect(
      resolveRegisterError("Username can only contain letters, numbers, hyphens, dots and underscores")
    ).toBe("Caractères interdits dans le pseudo.");
  });

  it("falls back to the raw message for an unmapped backend error", () => {
    expect(resolveRegisterError("Some new error the frontend hasn't seen yet")).toBe(
      "Some new error the frontend hasn't seen yet"
    );
  });

  it("falls back to the generic translated message when no message is given", () => {
    expect(resolveRegisterError(undefined)).toBe("Une erreur est survenue.");
  });
});
