/* =============================================================
   filterMenu.js — Système de filtres opus déroulant
   Partagé par tous les modes de jeu (Classic, Emoji,
   Silhouette, Music, Personae, AllOutAttack).

   Architecture :
     • Un bouton "FILTRES" (style Persona) ouvre/ferme le panneau
     • Chaque jeu a un bouton logo principal
       – P1, P5X  → filtre direct (pas de sous-opus)
       – P2        → IS + EP toujours visibles (auto-expand)
       – P3/P4/P5/PQ → clic logo = expand/collapse sous-opus
     • Les sous-filtres activent les opus précis de la BDD
       (P3FES, P3P, P4G, P4AU, P4D, P5R, P5S, P5T, PQ2…)
     • Persistance localStorage + migration depuis l'ancien format

   Exporté :
     initFilterMenu(storageKey, allOpus, onFilterChange)
     migrateLegacyOpusFilters — alias test-only de _migrate(), voir plus bas
   ============================================================= */

/* ── Migration : anciens codes larges → codes précis ───────────
   Quand l'utilisateur a sauvegardé "P3" dans l'ancien format,
   on l'étend automatiquement en ["P3", "P3FES", "P3P"]. */
const LEGACY_EXPAND = {
  P2: ["P2IS", "P2EP"],
  P3: ["P3", "P3FES", "P3P"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"],
  PQ: ["PQ", "PQ2"],
};

/* Opus ajoutés récemment : activés une fois pour un joueur qui a déjà des filtres
   sauvegardés en localStorage (sinon le nouvel opus reste invisible pour tous les
   joueurs existants jusqu'à ce qu'ils l'activent à la main). Retirer un code d'ici
   quand il n'est plus "nouveau".

   ⚠️ UNE SEULE FOIS par mode, mémorisé dans `<storageKey>_seeded` : réinjecter à
   chaque chargement rendait l'opus IMPOSSIBLE à décocher — il revenait au
   rechargement suivant, y compris après un « tout décocher » suivi d'un choix. */
const DEFAULT_ON_NEW = {
  /* Opus commun à tous les modes qui l'affichent. */
  _tous: ["PTS"],
  /* P1 n'est pas un opus « nouveau » en soi — il existe depuis toujours en
     Classique, Émoji et Silhouette, où un joueur a pu le décocher exprès. Il
     n'est nouveau QUE dans Personae (lot du 2026-08-20). Le forcer partout
     réactiverait un filtre volontairement désactivé ailleurs. */
  personaeActiveFilters: ["P1"],
};

/** Opus déjà proposés à ce joueur pour ce mode. */
function _seededOpus(storageKey) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${storageKey}_seeded`) || "[]"));
  } catch (_) {
    return new Set();
  }
}

/**
 * Marque des opus comme déjà proposés, sans rien activer.
 *
 * Utilisé pour le joueur qui n'a AUCUN filtre enregistré : tout est actif par
 * défaut chez lui, donc DEFAULT_ON_NEW n'a rien à lui apporter — mais s'il décoche
 * ensuite un de ces opus, le seed suivant le lui réactiverait une fois.
 */
function _markOpusSeeded(allOpus, storageKey) {
  const done = _seededOpus(storageKey);
  const candidats = [...DEFAULT_ON_NEW._tous, ...(DEFAULT_ON_NEW[storageKey] ?? [])];
  const nouveaux = candidats.filter((c) => allOpus.includes(c) && !done.has(c));
  if (nouveaux.length === 0) return;
  nouveaux.forEach((c) => done.add(c));
  try {
    localStorage.setItem(`${storageKey}_seeded`, JSON.stringify([...done]));
  } catch (_) {
    /* quota dépassé → silencieux */
  }
}

/**
 * Active les opus de DEFAULT_ON_NEW jamais encore proposés à ce joueur, pour ce
 * mode. Mute `activeOpus` et le renvoie.
 */
function _seedNewOpus(activeOpus, allOpus, storageKey) {
  const key = `${storageKey}_seeded`;
  const done = _seededOpus(storageKey);

  const candidats = [...DEFAULT_ON_NEW._tous, ...(DEFAULT_ON_NEW[storageKey] ?? [])];
  const nouveaux = candidats.filter((c) => allOpus.includes(c) && !done.has(c));
  if (nouveaux.length === 0) return activeOpus;

  for (const code of nouveaux) {
    done.add(code);
    if (!activeOpus.includes(code)) activeOpus.push(code);
  }
  try {
    localStorage.setItem(key, JSON.stringify([...done]));
    // Persister AUSSI la liste : sans ça le seed ne tenait qu'un chargement.
    // Le drapeau `_seeded` était écrit tout de suite, la liste non — au
    // rechargement suivant l'opus n'était plus réinjecté (déjà « seedé ») et
    // disparaissait définitivement pour un joueur qui n'avait touché à aucun
    // filtre entre-temps.
    localStorage.setItem(storageKey, JSON.stringify(activeOpus));
  } catch (_) {
    /* quota dépassé → silencieux */
  }
  return activeOpus;
}

/**
 * Migre une ancienne liste de filtres larges (["P3", "P4"…])
 * vers les codes précis acceptés par allOpus.
 * Retourne null si saved est null/invalide.
 *
 * @param {string[]|null} saved    - Valeur lue depuis localStorage
 * @param {string[]}      allOpus  - Tous les codes valides pour ce mode
 * @returns {string[]|null}
 */
function _migrate(saved, allOpus) {
  if (!Array.isArray(saved)) return null;
  if (saved.length === 0) return []; // preserve "all deselected" state

  const result = [];
  for (const code of saved) {
    const children = LEGACY_EXPAND[code];
    if (children) {
      // Only treat as legacy broad code if none of its children are already
      // in the saved array (new format stores precise codes like ["P5","P5R"]).
      // Detect new-format: if any CHILD (other than the parent code itself) is in saved,
      // this is the new precise format. Otherwise it's the old broad-code format.
      const alreadyPrecise = children.some((c) => c !== code && saved.includes(c));
      if (alreadyPrecise) {
        // New format: "P5" is a precise base-game entry alongside "P5R" etc.
        if (allOpus.includes(code)) result.push(code);
      } else {
        // Old format: "P5" meaning "all P5 games" → expand to all children
        result.push(...children.filter((c) => allOpus.includes(c)));
      }
    } else if (allOpus.includes(code)) {
      // Already a precise code with no expansion entry
      result.push(code);
    }
    // Unknown codes → ignore
  }
  return result.length > 0 ? [...new Set(result)] : null;
}

// Exporté uniquement pour les tests unitaires (tests/gameCore.test.js) — l'usage
// interne du module passe toujours par _migrate() ci-dessus, pas par cet alias.
export { _migrate as migrateLegacyOpusFilters };

/* =============================================================
   INIT — Point d'entrée principal
   ============================================================= */

/**
 * Initialise le panneau de filtres opus déroulant.
 *
 * Doit être appelé après DOMContentLoaded.
 * Les éléments HTML nécessaires (#filterToggleBtn, #filterDropdown)
 * doivent déjà exister dans le DOM.
 *
 * @param {string}   storageKey     - Clé localStorage pour ce mode
 *                                    ex : "filters_Classic"
 * @param {string[]} allOpus        - Tous les codes opus disponibles pour ce mode
 *                                    ex : ["P1","P2IS","P2EP","P3","P3FES",…]
 *                                    Seuls ces codes seront retournés au callback.
 * @param {Function} onFilterChange - Appelé avec (string[]) à chaque changement.
 *                                    Reçoit une copie des codes actifs.
 * @returns {{ getActive: () => string[] }}
 */
export function initFilterMenu(storageKey, allOpus, onFilterChange) {
  /* ── 1. Chargement + migration depuis localStorage ─────────── */
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey));
  } catch (_) {
    /* localStorage indisponible → on ignore */
  }

  const migrated = _migrate(stored, allOpus);
  // Liste vide = « tout décoché » assumé par le joueur : on n'y réinjecte rien.
  // Aucun filtre enregistré = joueur neuf, tout est déjà actif : rien à seeder non
  // plus, mais il faut MARQUER les opus comme déjà proposés. Sans ça, un joueur qui
  // décochait PTS (ou P1 en Personae) le voyait réapparaître au chargement suivant,
  // son premier `_seedNewOpus` n'ayant jamais eu lieu.
  let activeOpus;
  if (migrated === null) {
    activeOpus = [...allOpus];
    _markOpusSeeded(allOpus, storageKey);
  } else if (migrated.length === 0) {
    activeOpus = migrated;
  } else {
    activeOpus = _seedNewOpus(migrated, allOpus, storageKey);
  }
  let selectAllBtn = null;

  /* ── 2. Bouton toggle global ────────────────────────────────── */
  const toggleBtn = document.getElementById("filterToggleBtn");
  const dropdown = document.getElementById("filterDropdown");

  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    toggleBtn.classList.toggle("open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    dropdown.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      // Envoie le focus dans le panneau à l'ouverture (menu déroulant, pas une
      // modale — pas de piège Tab ici, cf. WAI-ARIA menu-button pattern).
      dropdown.querySelector('button:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
    }
  });

  /* ── 2b. Bouton "Tout cocher / Tout décocher" ──────────────── */
  /*
     Injecté dynamiquement en tête du dropdown (avant les groupes).
     Toggle : si tout est actif → désactiver tout ; sinon → tout activer.
     Le texte et le data-state sont mis à jour dans _syncUI().
  */
  if (dropdown) {
    selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "filter-select-all-btn";
    dropdown.prepend(selectAllBtn);

    selectAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const allActive = allOpus.every((o) => activeOpus.includes(o));
      activeOpus = allActive ? [] : [...allOpus];
      _syncUI();
      _updateEmptyWarning();
      _save();
      onFilterChange([...activeOpus]);
    });
  }

  /* ── 2c. Boutons "Tout cocher" par groupe de sous-opus ─────── */
  /*
     Injectés en tête de chaque .filter-sub-panel (P2, P3, P4, P5, PQ…).
     Toggle le groupe entier : tous actifs → tout décocher ; sinon → tout cocher.
     Utile pour activer/désactiver rapidement un jeu complet et ses spin-offs.
  */
  document.querySelectorAll("[data-group-panel]").forEach((subPanel) => {
    const group = subPanel.dataset.groupPanel;
    const mainBtn = document.querySelector(`[data-opus-group="${group}"]`);

    // Codes pour le groupe : lus depuis data-opus-codes du bouton principal,
    // ou depuis les sous-boutons directs (cas P2 auto-expand sans main-btn)
    const codes = mainBtn
      ? (mainBtn.dataset.opusCodes ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((c) => allOpus.includes(c))
      : Array.from(subPanel.querySelectorAll(".filter-sub-btn[data-opus]"))
          .map((b) => b.dataset.opus)
          .filter((c) => allOpus.includes(c));

    if (codes.length === 0) return;

    const groupBtn = document.createElement("button");
    groupBtn.type = "button";
    groupBtn.className = "filter-group-select-btn";
    groupBtn.dataset.groupCodes = codes.join(",");
    subPanel.prepend(groupBtn);

    groupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const allGroupActive = codes.every((c) => activeOpus.includes(c));
      if (allGroupActive) {
        activeOpus = activeOpus.filter((c) => !codes.includes(c));
      } else {
        codes.forEach((c) => {
          if (!activeOpus.includes(c)) activeOpus.push(c);
        });
      }
      _syncUI();
      _updateEmptyWarning();
      _save();
      onFilterChange([...activeOpus]);
    });
  });

  /* ── 3. Fermeture au clic en dehors du panneau ──────────────── */
  // e.isTrusted === false → clic programmatique (ex: resetButton.click() dans onFilterChange)
  // On ignore ces événements pour éviter que le panneau se ferme après un changement de filtre.
  document.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const panel = document.getElementById("filterPanel");
    if (panel && !panel.contains(e.target)) {
      _closePannel();
    }
  });

  /* Touche Escape ferme aussi le panneau */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") _closePannel();
  });

  function _closePannel() {
    // Restaure le focus sur le bouton toggle seulement si le focus était encore
    // dans le panneau (ex: fermeture via Escape) — pas si l'utilisateur a cliqué
    // ailleurs, pour ne pas lui voler le focus de sa véritable cible.
    const restoreFocus =
      dropdown?.classList.contains("open") && dropdown.contains(document.activeElement);
    dropdown?.classList.remove("open");
    toggleBtn?.classList.remove("open");
    toggleBtn?.setAttribute("aria-expanded", "false");
    dropdown?.setAttribute("aria-hidden", "true");
    if (restoreFocus) toggleBtn?.focus();
  }

  /* ── 4. Boutons logos principaux (expand/collapse groupe) ───── */
  /*
     Sélecteur : .filter-main-btn[data-opus-group]
     data-opus-group  = "P3"  (identifiant du groupe)
     data-opus-codes  = "P3,P3FES,P3P"  (codes couverts)

     Clic → expand/collapse le sous-panneau.
     Active si au moins un sous-code est actif (visuel seulement).
  */
  document.querySelectorAll(".filter-main-btn[data-opus-group]").forEach((btn) => {
    const group = btn.dataset.opusGroup;
    const subPanel = document.querySelector(`[data-group-panel="${group}"]`);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = subPanel?.classList.toggle("expanded");
      btn.classList.toggle("expanded", !!isExpanded);
      btn.setAttribute("aria-expanded", String(!!isExpanded));
    });
  });

  /* ── 5. Boutons directs (P1, P5X — pas de sous-opus) ────────── */
  /*
     Sélecteur : .filter-main-btn[data-opus]:not([data-opus-group])
     Clic → toggle du code opus directement.
  */
  document.querySelectorAll(".filter-main-btn[data-opus]:not([data-opus-group])").forEach((btn) => {
    const opus = btn.dataset.opus;
    if (!allOpus.includes(opus)) return; // Code non valide pour ce mode → ignorer

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      _toggleCode(opus);
    });
  });

  /* ── 6. Boutons sous-filtres individuels ────────────────────── */
  /*
     Sélecteur : .filter-sub-btn[data-opus]
     Clic → toggle du code opus précis.
  */
  document.querySelectorAll(".filter-sub-btn[data-opus]").forEach((btn) => {
    const opus = btn.dataset.opus;
    if (!allOpus.includes(opus)) return; // Code absent de ce mode → ignorer

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      _toggleCode(opus);
    });
  });

  /* ── Helpers ─────────────────────────────────────────────────── */

  /** Active ou désactive un code opus et notifie le mode. */
  function _toggleCode(opus) {
    if (activeOpus.includes(opus)) {
      activeOpus = activeOpus.filter((o) => o !== opus);
    } else {
      activeOpus.push(opus);
    }
    _syncUI();
    _updateEmptyWarning();
    _save();
    onFilterChange([...activeOpus]);
  }

  /**
   * Synchronise l'état visuel (classes CSS .active) de tous
   * les boutons de filtre selon `activeOpus`.
   *
   * • Sous-filtres : active si leur code est dans activeOpus.
   * • Boutons directs (P1, P5X) : idem.
   * • Boutons groupe (P3, P4…) : active si ≥1 sous-code actif.
   */
  function _syncUI() {
    // Sous-filtres
    document.querySelectorAll(".filter-sub-btn[data-opus]").forEach((btn) => {
      btn.classList.toggle("active", activeOpus.includes(btn.dataset.opus));
    });

    // Boutons directs
    document
      .querySelectorAll(".filter-main-btn[data-opus]:not([data-opus-group])")
      .forEach((btn) => {
        btn.classList.toggle("active", activeOpus.includes(btn.dataset.opus));
      });

    // Boutons groupe : active si au moins un de leurs codes est actif
    document.querySelectorAll(".filter-main-btn[data-opus-group]").forEach((btn) => {
      const codes = (btn.dataset.opusCodes ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      btn.classList.toggle(
        "active",
        codes.some((c) => activeOpus.includes(c))
      );
    });

    // Bouton global tout-cocher / tout-décocher
    if (selectAllBtn) {
      const allActive = allOpus.every((o) => activeOpus.includes(o));
      selectAllBtn.textContent = allActive
        ? window.i18n?.t?.("ui.deselect_all") || "✗ Deselect all"
        : window.i18n?.t?.("ui.select_all") || "✓ Select all";
      selectAllBtn.dataset.state = allActive ? "deselect" : "select";
    }

    // Boutons tout-cocher par groupe
    document.querySelectorAll(".filter-group-select-btn[data-group-codes]").forEach((btn) => {
      const codes = btn.dataset.groupCodes.split(",");
      const allActive = codes.every((c) => activeOpus.includes(c));
      btn.textContent = allActive
        ? window.i18n?.t?.("ui.deselect_all") || "✗ Deselect all"
        : window.i18n?.t?.("ui.select_all") || "✓ Select all";
      btn.dataset.state = allActive ? "deselect" : "select";
    });
  }

  /** Sauvegarde les filtres actifs dans localStorage. */
  function _save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(activeOpus));
    } catch (_) {
      /* quota dépassé → silencieux */
    }
  }

  /* ── Bandeau "aucun filtre" injecté dans #filterPanel ─────────── */
  const filterPanel = document.getElementById("filterPanel");
  let emptyWarning = null;
  if (filterPanel) {
    emptyWarning = document.createElement("div");
    emptyWarning.className = "filter-empty-warning";
    filterPanel.appendChild(emptyWarning);
  }

  function _updateEmptyWarning() {
    if (!emptyWarning) return;
    const isEmpty = activeOpus.length === 0;
    emptyWarning.hidden = !isEmpty;
    if (isEmpty) {
      const msg = window.i18n?.t?.("game.no_characters_filters");
      emptyWarning.textContent =
        msg && msg !== "game.no_characters_filters"
          ? msg
          : "⚠ No results — select at least one filter.";
    }
  }

  /* ── Init UI (sans déclencher le callback) ────────────────────── */
  _syncUI();
  _updateEmptyWarning();

  /* ── API retournée ──────────────────────────────────────────── */
  return {
    /** Retourne une copie des opus actifs. */
    getActive: () => [...activeOpus],
  };
}
