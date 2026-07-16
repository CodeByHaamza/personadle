/**
 * js/auth.js — Gestion de l'authentification côté frontend
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce module orchestre :
 *   1. La restauration de session au chargement de page (GET /api/auth/me)
 *   2. L'ouverture/fermeture des modales Login & Register
 *   3. La soumission des formulaires login/register (appels api.auth.*)
 *   4. La migration automatique du localStorage vers le compte cloud
 *      (appelée une seule fois juste après l'inscription)
 *   5. La déconnexion
 *   6. La sync des sessions en attente après connexion
 *   7. Le push du profil local vers le cloud à chaque chargement de page
 *      (_syncLocalProfileToCloud(), appelée depuis initAuth())
 *
 * POURQUOI UN MODULE SÉPARÉ
 * ─────────────────────────────────────────────────────────────────────────────
 * L'UI auth est présente dans profile.html et potentiellement dans d'autres
 * pages. Centraliser la logique ici évite la duplication et facilite
 * l'ajout futur d'autres pages nécessitant l'auth.
 *
 * ÉTAT GLOBAL
 * ─────────────────────────────────────────────────────────────────────────────
 * window._currentUser : null | { id, email, pseudo, lang, friend_code, ... }
 *   Initialisé par initAuth() au chargement.
 *   Mis à jour après login/register/logout.
 *   Les autres modules peuvent lire window._currentUser pour savoir si
 *   l'utilisateur est connecté sans refaire d'appel réseau.
 *
 * UTILISATION
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initAuth } from '../js/auth.js';
 *   await initAuth();
 *   // Ensuite : window._currentUser est défini
 */

import { api, ApiError } from "./api.js";
import { openModal, closeModal } from "./modal.js";

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT
// ─────────────────────────────────────────────────────────────────────────────

/** Utilisateur connecté, ou null si anonyme. Lecture seule depuis l'extérieur. */
window._currentUser = null;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS UI
// ─────────────────────────────────────────────────────────────────────────────

/** Affiche un message d'erreur dans un élément <p> dédié et le rend visible. */
function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

/** Cache un message d'erreur. */
function hideAuthError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

/** Traduit une clé i18n avec un vrai fallback (window.i18n.t renvoie la clé brute si absente). */
function _t(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

// Le backend (toujours en anglais) renvoie un jeu fini de messages d'erreur —
// on les mappe vers leurs traductions plutôt que d'afficher le texte brut.
// Voir api/auth/login.php et api/auth/register.php pour la liste exhaustive.
const LOGIN_ERROR_MAP = {
  "Email (or username) and password are required": () =>
    _t("auth.error_missing_fields", "Email (or username) and password are required."),
  "Invalid email or password": () =>
    _t("auth.error_wrong_credentials", "Incorrect email or password."),
  "Account banned. Contact support if you think this is an error.": () =>
    _t("auth.error_banned", "Account banned. Contact support if you think this is an error."),
};

const REGISTER_ERROR_MAP = {
  "Invalid email address": () => _t("auth.error_invalid_email", "Please enter a valid email address."),
  "Username must be between 3 and 50 characters": () =>
    _t("auth.error_pseudo_length", "Username must be between 3 and 50 characters."),
  "Username can only contain letters, numbers, hyphens, dots and underscores": () =>
    _t(
      "auth.error_pseudo_chars",
      "Username can only contain letters, numbers, hyphens, dots and underscores."
    ),
  "Password must be at least 8 characters": () =>
    _t("auth.error_password_length", "Password must be at least 8 characters."),
  "This password is too common — please choose a less predictable one": () =>
    _t("auth.error_password_common", "This password is too common — please choose a less predictable one."),
  "This email is already registered": () =>
    _t("auth.error_email_taken", "This email is already in use."),
  "This username is already taken": () =>
    _t("auth.error_pseudo_taken", "This username is already taken."),
  "Registration failed — please try again": () =>
    _t("auth.error_generic", "An error occurred. Please try again."),
};

/**
 * Résout le message d'erreur à afficher pour un échec de connexion.
 * Mappe les messages backend connus (toujours en anglais) vers leur
 * traduction ; retombe sur le message brut puis sur un message générique.
 * @param {string} [message] - err.message d'une ApiError (voir js/api.js)
 */
export function resolveLoginError(message) {
  return LOGIN_ERROR_MAP[message]?.() || message || _t("auth.error_generic", "Login failed");
}

/**
 * Idem pour un échec d'inscription. Voir resolveLoginError().
 * @param {string} [message]
 */
export function resolveRegisterError(message) {
  return (
    REGISTER_ERROR_MAP[message]?.() || message || _t("auth.error_generic", "Registration failed")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MISE À JOUR DE L'UI selon l'état de connexion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Met à jour les éléments de la page qui dépendent de l'état connecté/déconnecté.
 *
 * Convention : les éléments avec [data-auth="connected"] sont visibles si connecté,
 * ceux avec [data-auth="anonymous"] sont visibles si déconnecté.
 *
 * @param {object|null} user
 */
export function updateAuthUI(user) {
  window._currentUser = user;

  // Sync the player seed ID used by getDailyTarget() in gameCore.js.
  // Logged-in  → use numeric user_id (consistent across devices/sessions)
  // Logged-out → remove user_id; getPlayerSeedId() will fall back to anonPlayerId
  if (user) {
    localStorage.setItem("playerUserId", String(user.id));
  } else {
    localStorage.removeItem("playerUserId");
  }

  // Afficher/masquer les zones selon l'état
  document.querySelectorAll('[data-auth="connected"]').forEach((el) => {
    el.style.display = user ? "" : "none";
  });
  document.querySelectorAll('[data-auth="anonymous"]').forEach((el) => {
    el.style.display = user ? "none" : "";
  });

  // Remplir les éléments portant [data-auth-field]
  if (user) {
    document.querySelectorAll("[data-auth-field]").forEach((el) => {
      const field = el.getAttribute("data-auth-field");
      if (field in user) el.textContent = user[field];
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION localStorage → cloud
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le payload de migration depuis localStorage et l'envoie à l'API.
 *
 * Appelé une seule fois, juste après l'inscription réussie.
 * Un flag `migratedToCloud` dans localStorage empêche toute double migration.
 *
 * Structure du payload :
 *   {
 *     profile: <contenu de 'personaUserProfile'>,   // stats, avatar, badges...
 *     pendingSessions: <contenu de 'pendingSessions'> // parties jouées offline
 *   }
 */
async function migrateLocalStorageToCloud() {
  // Éviter une double migration si elle a déjà eu lieu
  if (localStorage.getItem("migratedToCloud") === "true") return;

  const profileRaw = localStorage.getItem("personaUserProfile");
  const sessionsRaw = localStorage.getItem("pendingSessions");

  // Rien à migrer
  if (!profileRaw && !sessionsRaw) {
    localStorage.setItem("migratedToCloud", "true");
    return;
  }

  let profile = null;
  let pendingSessions = [];

  try {
    if (profileRaw) profile = JSON.parse(profileRaw);
    if (sessionsRaw) pendingSessions = JSON.parse(sessionsRaw);
  } catch {
    // JSON corrompu — on migre ce qu'on peut
  }

  try {
    const result = await api.user.migrate({ profile, pendingSessions });
    console.info(
      `[Auth] Migration complete — ${result.migrated_sessions} sessions migrated,` +
        ` ${result.skipped_sessions} skipped.`
    );

    // Migration réussie : vider la queue locale (les sessions sont en BDD)
    localStorage.removeItem("pendingSessions");
    localStorage.setItem("migratedToCloud", "true");
  } catch (e) {
    // 409 = déjà migré côté serveur → marquer localement pour ne plus réessayer
    if (e?.status === 409) {
      localStorage.setItem("migratedToCloud", "true");
      return;
    }
    // 5xx = erreur serveur irrécupérable (ex: colonne manquante) → ne pas boucler
    if (e?.status >= 500) {
      console.warn("[Auth] Migration server error — stopping retries:", e.message);
      localStorage.setItem("migratedToCloud", "true");
      return;
    }
    // Erreur réseau / timeout → réessai autorisé au prochain chargement
    console.warn("[Auth] Migration failed (will retry later):", e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE LOGIN
// ─────────────────────────────────────────────────────────────────────────────

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  const error = document.getElementById("loginError");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthError(error);

    const identifier = document.getElementById("loginEmail")?.value.trim() ?? "";
    const password = document.getElementById("loginPassword")?.value ?? "";

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const { user } = await api.auth.login({ identifier, password });
      updateAuthUI(user);
      closeModal("loginModal");
      localStorage.removeItem("_crInitDone");
      window.dispatchEvent(new CustomEvent("personadle:auth-login", { detail: { user } }));

      // Synchroniser les sessions en attente accumulées en offline
      await api.stats.syncPending().catch(() => {});
    } catch (err) {
      // err peut ne pas être une ApiError (ex: réponse serveur vide/invalide qui fait
      // échouer un `const { user } = ...` en amont) — ne jamais afficher un message
      // JS brut à l'utilisateur, seulement les messages backend connus/mappés.
      showAuthError(
        error,
        err instanceof ApiError ? resolveLoginError(err.message) : _t("auth.error_generic", "Login failed")
      );
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // ── Mot de passe oublié → bascule vers la demande de réinitialisation ──
  const resetForm = document.getElementById("resetRequestForm");
  const resetMsg = document.getElementById("resetMsg");

  document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => {
    hideAuthError(error);
    form.classList.add("hidden");
    resetForm?.classList.remove("hidden");
  });
  document.getElementById("cancelReset")?.addEventListener("click", () => {
    resetForm?.classList.add("hidden");
    form.classList.remove("hidden");
  });

  resetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("resetEmail")?.value.trim() ?? "";
    const btn = resetForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await api.auth.requestReset({ email });
    } catch (_) {
      /* anti-énumération : message identique quoi qu'il arrive */
    }
    if (resetMsg) {
      resetMsg.textContent = _t(
        "auth.reset_sent",
        "If that email exists, a reset link has been sent. Check your inbox."
      );
      resetMsg.classList.remove("hidden");
    }
    if (btn) btn.disabled = false;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE REGISTER
// ─────────────────────────────────────────────────────────────────────────────

function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  const error = document.getElementById("registerError");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthError(error);

    const email = document.getElementById("registerEmail")?.value.trim() ?? "";
    const pseudo = document.getElementById("registerPseudo")?.value.trim() ?? "";
    const password = document.getElementById("registerPassword")?.value ?? "";
    const confirm = document.getElementById("registerPasswordConfirm")?.value ?? "";

    // Validation côté client (doublée côté serveur)
    if (password !== confirm) {
      showAuthError(error, _t("auth.error_passwords_mismatch", "Passwords do not match."));
      return;
    }
    if (password.length < 8) {
      showAuthError(error, _t("auth.error_password_length", "Password must be at least 8 characters."));
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    // Récupérer la langue active pour la transmettre au compte
    const lang = localStorage.getItem("lang") || "en";

    try {
      const { user } = await api.auth.register({ email, pseudo, password, lang });
      updateAuthUI(user);
      closeModal("registerModal");

      // Si un JSON a été sélectionné, l'injecter dans localStorage avant la migration
      const fileInput = document.getElementById("registerImportJson");
      if (fileInput?.files?.length) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const imported = JSON.parse(ev.target.result);
              if (imported && typeof imported === "object") {
                // Retirer _accountId pour que la migration ne soit pas bloquée
                delete imported._accountId;
                localStorage.setItem("personaUserProfile", JSON.stringify(imported));
                localStorage.removeItem("migratedToCloud");
              }
            } catch {
              /* JSON invalide — on ignore */
            }
            resolve();
          };
          reader.onerror = resolve;
          reader.readAsText(fileInput.files[0]);
        });
      }

      // Migration immédiate du localStorage vers le compte qui vient d'être créé
      await migrateLocalStorageToCloud();
      localStorage.removeItem("_crInitDone");
      window.dispatchEvent(new CustomEvent("personadle:auth-login", { detail: { user } }));
    } catch (err) {
      // Voir commentaire équivalent dans setupLoginForm() plus haut.
      showAuthError(
        error,
        err instanceof ApiError
          ? resolveRegisterError(err.message)
          : _t("auth.error_generic", "Registration failed")
      );
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTONS NAVIGATION ENTRE MODALES
// ─────────────────────────────────────────────────────────────────────────────

function setupModalNavigation() {
  // Fermeture
  document
    .getElementById("closeLoginModal")
    ?.addEventListener("click", () => closeModal("loginModal"));
  document
    .getElementById("closeRegisterModal")
    ?.addEventListener("click", () => closeModal("registerModal"));

  // Basculer login ↔ register
  document.getElementById("switchToRegister")?.addEventListener("click", () => {
    closeModal("loginModal");
    openModal("registerModal");
  });
  document.getElementById("switchToLogin")?.addEventListener("click", () => {
    closeModal("registerModal");
    openModal("loginModal");
  });

  // Boutons d'ouverture (data-open-modal="loginModal" etc.)
  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.getAttribute("data-open-modal")));
  });

  // Fermer en cliquant en dehors de la modale
  ["loginModal", "registerModal"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCONNEXION
// ─────────────────────────────────────────────────────────────────────────────

function setupLogoutButton() {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.auth.logout();
      } catch {
        // Même en cas d'erreur réseau, on nettoie l'UI locale
      }
      // Vider le profil local : le prochain utilisateur qui se connecte
      // sur ce navigateur repart d'un profil vierge et récupère le sien depuis le cloud.
      localStorage.removeItem("personaUserProfile");
      localStorage.removeItem("personaSettings");
      updateAuthUI(null);
      window.dispatchEvent(new CustomEvent("personadle:auth-logout"));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC PROFIL localStorage → cloud (toutes pages)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit le profil depuis localStorage et pousse les champs de présentation
 * (avatar, bordure, wallpaper, musique, badges) vers la BDD via PATCH.
 * Appelé sur chaque page après résolution de l'auth, pas seulement profile.html.
 * Fire-and-forget — les erreurs réseau sont silencieuses.
 */
async function _syncLocalProfileToCloud(userId) {
  const api = window._personadleApi;
  if (!api || !userId) return;

  let profile = null;
  try {
    const raw = localStorage.getItem("personaUserProfile");
    if (!raw) return;
    profile = JSON.parse(raw);
  } catch {
    return;
  }

  const fields = {
    avatar_border_color: profile.avatarBorderColor || "#ffffff",
    wallpaper_id:
      profile.profileTheme === "custom"
        ? `custom:${profile.profileCustomColor || "#e63946"}`
        : profile.profileTheme || null,
    profile_music_id: profile.profileSong?.fichier || profile.profileMusicId || null,
    selected_badges: profile.selectedBadges || [],
  };
  if (profile.avatar) fields.avatar_data = profile.avatar;
  if (profile.equippedTitleId != null) fields.equipped_title_id = profile.equippedTitleId;

  try {
    await api.user.update(userId, fields);
  } catch {
    // Silencieux — le sync se retente à chaque chargement de page
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POINT D'ENTRÉE — initAuth()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise le système d'auth pour la page courante.
 *
 * À appeler une fois au chargement :
 *   import { initAuth } from '../js/auth.js';
 *   await initAuth();
 *
 * Séquence :
 *   1. GET /api/auth/me → restaure la session si cookie valide
 *   2. Met à jour l'UI (zones connecté / anonyme)
 *   3. Si connecté, synchronise les sessions en attente
 *   4. Si connecté, pousse le profil local vers le cloud (_syncLocalProfileToCloud)
 *   5. Branche les formulaires et boutons
 */
export async function initAuth() {
  // 1. Restaurer la session
  try {
    const { user } = await api.auth.me();
    updateAuthUI(user);

    // 2. Si connecté, sync des sessions offline accumulées (fire-and-forget)
    // On ne bloque pas initAuth() sur une opération réseau non critique.
    if (user) {
      api.stats.syncPending().catch(() => {});
      _syncLocalProfileToCloud(user.id).catch(() => {});
    }
  } catch {
    // Serveur inaccessible (offline, déploiement en cours) → mode anonyme
    updateAuthUI(null);
  } finally {
    // Signal que la résolution d'auth est terminée (connecté ou non).
    // Permet aux pages qui attendent window._authResolved de ne pas
    // bloquer 2 s inutilement quand l'utilisateur n'est pas connecté.
    window._authResolved = true;
  }

  // 3. Brancher formulaires + navigation modales + logout
  setupLoginForm();
  setupRegisterForm();
  setupModalNavigation();
  setupLogoutButton();
}
