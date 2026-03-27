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
   ============================================================= */

/* ── Migration : anciens codes larges → codes précis ───────────
   Quand l'utilisateur a sauvegardé "P3" dans l'ancien format,
   on l'étend automatiquement en ["P3", "P3FES", "P3P"]. */
const LEGACY_EXPAND = {
  P2:  ["P2IS",  "P2EP"],
  P3:  ["P3",    "P3FES", "P3P"],
  P4:  ["P4",    "P4G",   "P4AU", "P4D"],
  P5:  ["P5",    "P5R",   "P5S",  "P5T"],
  PQ:  ["PQ",   "PQ2"],
};

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

  const result = [];
  for (const code of saved) {
    if (LEGACY_EXPAND[code]) {
      // Ancien code large → expand en sous-codes présents dans allOpus
      result.push(...LEGACY_EXPAND[code].filter(c => allOpus.includes(c)));
    } else if (allOpus.includes(code)) {
      // Code déjà précis → conserver
      result.push(code);
    }
    // Codes inconnus (ex P3R absent de la BDD) → ignorer
  }
  // Dédupliquer
  return result.length > 0 ? [...new Set(result)] : null;
}


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
  } catch (_) { /* localStorage indisponible → on ignore */ }

  const migrated = _migrate(stored, allOpus);
  let activeOpus = migrated ?? [...allOpus]; // défaut : tout actif
  let selectAllBtn = null;


  /* ── 2. Bouton toggle global ────────────────────────────────── */
  const toggleBtn = document.getElementById("filterToggleBtn");
  const dropdown  = document.getElementById("filterDropdown");

  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    toggleBtn.classList.toggle("open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    dropdown.setAttribute("aria-hidden", String(!isOpen));
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
    const group   = subPanel.dataset.groupPanel;
    const mainBtn = document.querySelector(`[data-opus-group="${group}"]`);

    // Codes pour le groupe : lus depuis data-opus-codes du bouton principal,
    // ou depuis les sous-boutons directs (cas P2 auto-expand sans main-btn)
    const codes = mainBtn
      ? (mainBtn.dataset.opusCodes ?? "").split(",").map(s => s.trim()).filter(c => allOpus.includes(c))
      : Array.from(subPanel.querySelectorAll(".filter-sub-btn[data-opus]"))
              .map(b => b.dataset.opus).filter(c => allOpus.includes(c));

    if (codes.length === 0) return;

    const groupBtn = document.createElement("button");
    groupBtn.type  = "button";
    groupBtn.className      = "filter-group-select-btn";
    groupBtn.dataset.groupCodes = codes.join(",");
    subPanel.prepend(groupBtn);

    groupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const allGroupActive = codes.every(c => activeOpus.includes(c));
      if (allGroupActive) {
        activeOpus = activeOpus.filter(c => !codes.includes(c));
      } else {
        codes.forEach(c => { if (!activeOpus.includes(c)) activeOpus.push(c); });
      }
      _syncUI();
      _save();
      onFilterChange([...activeOpus]);
    });
  });


  /* ── 3. Fermeture au clic en dehors du panneau ──────────────── */
  document.addEventListener("click", (e) => {
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
    dropdown?.classList.remove("open");
    toggleBtn?.classList.remove("open");
    toggleBtn?.setAttribute("aria-expanded", "false");
    dropdown?.setAttribute("aria-hidden", "true");
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
    const group    = btn.dataset.opusGroup;
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
      activeOpus = activeOpus.filter(o => o !== opus);
    } else {
      activeOpus.push(opus);
    }
    _syncUI();
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
    document.querySelectorAll(".filter-main-btn[data-opus]:not([data-opus-group])").forEach((btn) => {
      btn.classList.toggle("active", activeOpus.includes(btn.dataset.opus));
    });

    // Boutons groupe : active si au moins un de leurs codes est actif
    document.querySelectorAll(".filter-main-btn[data-opus-group]").forEach((btn) => {
      const codes = (btn.dataset.opusCodes ?? "")
        .split(",").map(s => s.trim()).filter(Boolean);
      btn.classList.toggle("active", codes.some(c => activeOpus.includes(c)));
    });

    // Bouton global tout-cocher / tout-décocher
    if (selectAllBtn) {
      const allActive = allOpus.every((o) => activeOpus.includes(o));
      selectAllBtn.textContent = allActive ? "✗ Tout décocher" : "✓ Tout cocher";
      selectAllBtn.dataset.state = allActive ? "deselect" : "select";
    }

    // Boutons tout-cocher par groupe
    document.querySelectorAll(".filter-group-select-btn[data-group-codes]").forEach((btn) => {
      const codes    = btn.dataset.groupCodes.split(",");
      const allActive = codes.every(c => activeOpus.includes(c));
      btn.textContent  = allActive ? "✗ Tout décocher" : "✓ Tout cocher";
      btn.dataset.state = allActive ? "deselect" : "select";
    });
  }

  /** Sauvegarde les filtres actifs dans localStorage. */
  function _save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(activeOpus));
    } catch (_) { /* quota dépassé → silencieux */ }
  }

  /* ── Init UI (sans déclencher le callback) ────────────────────── */
  _syncUI();

  /* ── API retournée ──────────────────────────────────────────── */
  return {
    /** Retourne une copie des opus actifs. */
    getActive: () => [...activeOpus],
  };
}
