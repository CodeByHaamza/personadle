-- ─────────────────────────────────────────────────────────────────────────────
-- 054 — Avatars déblocables (tables `avatars` + `user_avatars`), pack Kotone
--
-- Jusqu'ici la galerie de portraits vivait ENTIÈREMENT côté client
-- (profile/avatars_data.js) : ~350 fichiers, tous disponibles pour tout le monde,
-- rien en base. La 2.3 introduit des portraits qui se MÉRITENT, ce que le client
-- ne peut pas décider — cf. le précédent du 2026-09-19 : tant qu'un déblocage
-- dépendait de ce que le client pensait à demander, ~290 titres et ~100 badges dus
-- dormaient en prod sans que personne ne frappe à la porte.
--
-- Modèle calqué sur `wallpapers` / `user_wallpapers` :
--   - `avatars`       : SEULEMENT les portraits déblocables. Les ~350 portraits
--                       libres restent dans avatars_data.js — aucune migration de
--                       l'existant, donc aucun risque de régression sur ce qui marche.
--   - `user_avatars`  : ce que chaque joueur a débloqué. Une ligne ici est ACQUISE
--                       À VIE : rien ne la retire, conformément à la règle « un accès
--                       gagné ne se reperd jamais » (CLAUDE.md §7).
--
-- Le pack Kotone se débloque d'un bloc, sur une condition composite vérifiée par
-- api/lib/condition_check.php (`avatar_pack_kotone`). Les six portraits partagent
-- la même condition : ils s'accordent donc ensemble, comme voulu.
--
-- Idempotente : `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` (clé primaire sur
-- l'id textuel). Rejouable sans effet de bord.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Catalogue ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avatars (
    id                  VARCHAR(64)         NOT NULL PRIMARY KEY,
    -- Nom affiché. Pas de colonnes name_fr/name_es/… : un nom de portrait est un
    -- nom de personnage (« Kotone Shiomi »), qui ne se traduit pas — même règle
    -- que les noms de personas et de musiques (CLAUDE.md §5).
    name                VARCHAR(200)        NOT NULL DEFAULT '',
    -- Clé de groupe de la galerie ('persona3', 'persona5x'…), pour que l'onglet
    -- déblocable se range comme le reste.
    game                VARCHAR(16),
    -- Chemin relatif depuis la racine du site, comme `wallpapers.image_path`.
    image_path          VARCHAR(255)        NOT NULL DEFAULT '',
    -- Un portrait animé se signale à l'UI : elle en fait un aperçu, pas une vignette
    -- figée. La colonne évite de déduire l'animation de l'extension (un .webp peut
    -- être fixe).
    is_animated         TINYINT(1)          NOT NULL DEFAULT 0,
    -- Regroupe les portraits qui se débloquent ensemble ('kotone'). NULL = portrait
    -- déblocable isolé.
    pack_id             VARCHAR(64)         NULL,
    -- Texte d'affichage de la condition (anglais, source de vérité i18n) : c'est ce
    -- que le joueur lit sur une vignette verrouillée. Sans lui, un pack à six
    -- conditions est invisible, donc inexistant pour lui.
    unlock_condition    VARCHAR(500)        NULL,
    -- condition_type/mode/value : même vocabulaire que badges/titles/wallpapers,
    -- vérifié par api/lib/condition_check.php.
    condition_type      VARCHAR(50)         NULL,
    condition_mode      VARCHAR(30)         NULL,
    condition_value     INT                 NULL,
    -- Ordre d'affichage dans l'onglet, à pack égal.
    sort_order          INT                 NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Déblocages par joueur ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_avatars (
    user_id             BIGINT UNSIGNED     NOT NULL,
    avatar_id           VARCHAR(64)         NOT NULL,
    unlocked_at         TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, avatar_id),
    CONSTRAINT fk_ua_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    CONSTRAINT fk_ua_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pack Kotone Shiomi ──────────────────────────────────────────────────────
-- Six portraits ANIMÉS, quatre de Kotone et deux de Theodore. La condition
-- `avatar_pack_kotone` est composite et doit être vraie D'UN SEUL TENANT au moment
-- où le serveur réconcilie (décision Hamza) :
--   1. son All-Out Attack, en normal ET en Expert
--   2. son titre `kotone_not_a_princess` ÉQUIPÉ
--   3. la bordure de profil rose (#ff6b9d, la pastille de la palette) PORTÉE
--   4. une de ses personas exclusives, en Personae normal ET Expert
--   5. les cinq musiques exclusives à P3P, en Music normal ET Expert
--   6. Kotone ET Theodore reconnus en Silhouette
-- Les points 2 et 3 sont de l'état courant : c'est le « rituel » voulu. Une fois la
-- ligne posée dans user_avatars, elle ne bouge plus — déséquiper le titre ensuite
-- ne reprend rien.
INSERT IGNORE INTO avatars
    (id, name, game, image_path, is_animated, pack_id, unlock_condition, condition_type, condition_mode, condition_value, sort_order)
VALUES
    ('kotone_listening',   'Kotone Shiomi', 'persona3', 'img/avatar/unlockable/kotone_listening.webp',   1, 'kotone',
     'Kotone''s ritual: her All-Out Attack (normal + Expert), her persona in Personae (normal + Expert), all five P3P-only songs (normal + Expert), Kotone and Theodore in Silhouette — then equip her title and wear the pink profile border (#ff6b9d) at the same time.',
     'avatar_pack_kotone', NULL, NULL, 1),
    ('kotone_butterfly',   'Kotone Shiomi', 'persona3', 'img/avatar/unlockable/kotone_butterfly.webp',   1, 'kotone',
     'Unlocked with the Kotone pack.', 'avatar_pack_kotone', NULL, NULL, 2),
    ('kotone_orpheus',     'Kotone Shiomi', 'persona3', 'img/avatar/unlockable/kotone_orpheus.webp',     1, 'kotone',
     'Unlocked with the Kotone pack.', 'avatar_pack_kotone', NULL, NULL, 3),
    ('kotone_pink_shot',   'Kotone Shiomi', 'persona3', 'img/avatar/unlockable/kotone_pink_shot.webp',   1, 'kotone',
     'Unlocked with the Kotone pack.', 'avatar_pack_kotone', NULL, NULL, 4),
    ('theodore_elevator',  'Theodore',      'persona3', 'img/avatar/unlockable/theodore_elevator.webp',  1, 'kotone',
     'Unlocked with the Kotone pack.', 'avatar_pack_kotone', NULL, NULL, 5),
    ('theodore_look_back', 'Theodore',      'persona3', 'img/avatar/unlockable/theodore_look_back.webp', 1, 'kotone',
     'Unlocked with the Kotone pack.', 'avatar_pack_kotone', NULL, NULL, 6);
