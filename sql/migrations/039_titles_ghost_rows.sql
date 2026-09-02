-- =============================================================================
-- 039 — Titres fantômes : 7 doublons hérités de la migration 006
-- =============================================================================
-- Constaté en prod le 2026-09-02 : 7 titres existent DEUX FOIS, sous un slug
-- court (ancien) et un slug préfixé par le personnage (canonique) :
--
--   thou_art_i      ↔ velvet_room_thou_art_i        memento_mori   ↔ makoto_yuki_memento_mori
--   i_am_not_afraid ↔ aigis_i_am_not_afraid         ride_the_wind  ↔ yosuke_ride_the_wind
--   boring_isnt_it  ↔ adachi_boring_isnt_it         i_remembered   ↔ marie_i_remembered
--   reach_out       ↔ yu_reach_out_to_the_truth
--
-- Deux symptômes pour le joueur et l'admin :
--   - chaque titre apparaît en double dans le panneau admin ;
--   - un joueur ayant débloqué la VERSION FANTÔME voit son titre comme
--     verrouillé, puisque `profile/titles-ui.js` et le seed de référence
--     n'utilisent que les slugs canoniques.
--
-- ⚠️ CAUSE RACINE, à ne pas reproduire : la migration 006 renommait les slugs
-- avec des `UPDATE titles SET slug = ... WHERE id = 11..21`. Elle SUPPOSAIT une
-- numérotation d'ids qui n'était pas celle de la prod, donc elle a manqué sa
-- cible et les deux jeux ont coexisté. Une migration de contenu doit cibler une
-- clé métier stable (`slug`), jamais un id auto-incrémenté dont la valeur
-- dépend de l'ordre d'insertion de chaque environnement.
--
-- Ce fichier applique la règle : il ne cite AUCUN id. Sur une base neuve issue
-- de bdd_mysql.sql, les slugs courts n'existent pas et tout est no-op.
--
-- Idempotente : rejouable sans effet (les fantômes ayant disparu, les jointures
-- ne ramènent plus rien).
--
-- ⚠️ Backup recommandé : les étapes 1 à 3 modifient des lignes existantes.
-- =============================================================================

-- ── Table de correspondance fantôme → canonique ─────────────────────────────
-- Temporaire plutôt que 7 requêtes répétées : une seule liste à relire, et
-- impossible d'en oublier une au milieu.
--
-- ⚠️ La collation est déclarée EXPLICITEMENT, et doit rester identique à celle
-- de `titles.slug` (utf8mb4_unicode_ci, cf. bdd_mysql.sql). Sans elle, la table
-- temporaire hérite du défaut de la connexion — utf8mb4_general_ci sur MariaDB
-- 10.6 — et la jointure `m.ghost_slug = ghost.slug` échoue en
-- « Illegal mix of collations », faisant avorter toute la migration.
-- Constaté au premier essai réel contre la base locale.
CREATE TEMPORARY TABLE IF NOT EXISTS _ghost_titles (
    ghost_slug VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
    canon_slug VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO _ghost_titles (ghost_slug, canon_slug) VALUES
    ('thou_art_i',      'velvet_room_thou_art_i'),
    ('memento_mori',    'makoto_yuki_memento_mori'),
    ('i_am_not_afraid', 'aigis_i_am_not_afraid'),
    ('ride_the_wind',   'yosuke_ride_the_wind'),
    ('boring_isnt_it',  'adachi_boring_isnt_it'),
    ('i_remembered',    'marie_i_remembered'),
    ('reach_out',       'yu_reach_out_to_the_truth');


-- ── 1. Transférer les titres débloqués vers l'entrée canonique ──────────────
-- IGNORE : si le joueur possède DÉJÀ le canonique, la ligne fantôme violerait
-- uq_user_title (user_id, title_id). IGNORE la laisse alors intacte ; l'étape 2
-- la supprime. Sans ce transfert, le DELETE final de l'étape 4 effacerait ces
-- acquis en cascade (user_titles.title_id est ON DELETE CASCADE) — le joueur
-- perdrait un titre qu'il a gagné.
UPDATE IGNORE user_titles ut
    JOIN titles ghost ON ghost.id   = ut.title_id
    JOIN _ghost_titles m ON m.ghost_slug = ghost.slug
    JOIN titles canon ON canon.slug = m.canon_slug
    SET ut.title_id = canon.id;


-- ── 2. Purger les acquis fantômes restants ──────────────────────────────────
-- Uniquement ceux que l'étape 1 n'a pas pu déplacer, c'est-à-dire les joueurs
-- qui détenaient les deux versions : le canonique leur reste.
DELETE ut FROM user_titles ut
    JOIN titles t ON t.id = ut.title_id
    JOIN _ghost_titles m ON m.ghost_slug = t.slug;


-- ── 3. Profils équipant un titre fantôme ────────────────────────────────────
-- Aucun au 2026-09-02, mais la FK est ON DELETE SET NULL : sans ce transfert,
-- un joueur concerné verrait son titre équipé disparaître en silence.
UPDATE profiles p
    JOIN titles ghost ON ghost.id   = p.equipped_title_id
    JOIN _ghost_titles m ON m.ghost_slug = ghost.slug
    JOIN titles canon ON canon.slug = m.canon_slug
    SET p.equipped_title_id = canon.id;


-- ── 4. Supprimer les 7 lignes fantômes ──────────────────────────────────────
DELETE t FROM titles t
    JOIN _ghost_titles m ON m.ghost_slug = t.slug;

DROP TEMPORARY TABLE IF EXISTS _ghost_titles;


-- ── Contrôle (à lancer à la main après application) ─────────────────────────
--   SELECT name_en, COUNT(*) n FROM titles GROUP BY name_en HAVING n > 1;
--     → doit être vide
--   SELECT COUNT(*) FROM user_titles ut LEFT JOIN titles t ON t.id = ut.title_id
--    WHERE t.id IS NULL;
--     → doit valoir 0 (aucun acquis orphelin)
