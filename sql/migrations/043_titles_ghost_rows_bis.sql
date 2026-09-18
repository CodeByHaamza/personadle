-- =============================================================================
-- 043 — Titres fantômes, suite : les 4 doublons que la 039 n'a pas vus
-- =============================================================================
-- Constaté en prod le 2026-09-15 en lisant `user_titles` du compte de Hamza :
-- quatre titres existent encore DEUX FOIS, sous un slug court (ancien) et le
-- slug canonique préfixé par le personnage — exactement le cas de la 039, qui
-- n'en listait que 7 :
--
--   looking_cool        ↔ joker_looking_cool
--   pancakes            ↔ akechi_pancakes
--   first_awakening     ↔ naoya_first_awakening
--   always_be_positive  ↔ maya_always_be_positive
--
-- Mêmes symptômes : doublons dans le panneau admin, et un joueur qui n'a
-- débloqué QUE la version fantôme voit son titre verrouillé (le client ne
-- connaît que les slugs canoniques — profile/titles-ui.js). Même méthode que
-- la 039 : aucun id cité, tout par slug ; no-op sur une base neuve.
--
-- Idempotente : rejouable sans effet une fois les fantômes disparus.
--
-- ⚠️ Backup recommandé : les étapes 1 à 3 modifient des lignes existantes.
-- =============================================================================

-- Collation explicite, identique à `titles.slug` — sinon la jointure tombe en
-- « Illegal mix of collations » sur MariaDB 10.6 (vécu avec la 039).
CREATE TEMPORARY TABLE IF NOT EXISTS _ghost_titles_bis (
    ghost_slug VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
    canon_slug VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO _ghost_titles_bis (ghost_slug, canon_slug) VALUES
    ('looking_cool',       'joker_looking_cool'),
    ('pancakes',           'akechi_pancakes'),
    ('first_awakening',    'naoya_first_awakening'),
    ('always_be_positive', 'maya_always_be_positive');


-- ── 1. Transférer les titres débloqués vers l'entrée canonique ──────────────
-- IGNORE : si le joueur possède DÉJÀ le canonique, la ligne fantôme violerait
-- uq_user_title ; elle reste, l'étape 2 la supprime. Sans transfert, le DELETE
-- final effacerait l'acquis en cascade (user_titles.title_id ON DELETE CASCADE).
UPDATE IGNORE user_titles ut
    JOIN titles ghost ON ghost.id   = ut.title_id
    JOIN _ghost_titles_bis m ON m.ghost_slug = ghost.slug
    JOIN titles canon ON canon.slug = m.canon_slug
    SET ut.title_id = canon.id;


-- ── 2. Purger les acquis fantômes restants (joueurs qui avaient les deux) ────
DELETE ut FROM user_titles ut
    JOIN titles t ON t.id = ut.title_id
    JOIN _ghost_titles_bis m ON m.ghost_slug = t.slug;


-- ── 3. Profils équipant un titre fantôme (FK ON DELETE SET NULL) ────────────
UPDATE profiles p
    JOIN titles ghost ON ghost.id   = p.equipped_title_id
    JOIN _ghost_titles_bis m ON m.ghost_slug = ghost.slug
    JOIN titles canon ON canon.slug = m.canon_slug
    SET p.equipped_title_id = canon.id;


-- ── 4. Supprimer les 4 lignes fantômes ──────────────────────────────────────
DELETE t FROM titles t
    JOIN _ghost_titles_bis m ON m.ghost_slug = t.slug;

DROP TEMPORARY TABLE IF EXISTS _ghost_titles_bis;


-- ── Contrôle (à lancer à la main après application) ─────────────────────────
--   SELECT slug FROM titles WHERE slug IN
--     ('looking_cool','pancakes','first_awakening','always_be_positive');
--     → doit être vide
--   SELECT COUNT(*) FROM user_titles ut LEFT JOIN titles t ON t.id = ut.title_id
--    WHERE t.id IS NULL;
--     → doit valoir 0 (aucun acquis orphelin)
