-- 024 — Reconciliation du sous-système "Social Link" avec le schéma courant.
--
-- CONTEXTE (bug prod du 2026-07-24, premier déploiement backend v2.0)
-- La base Hostinger de prod a été initialisée depuis l'ancienne archive
-- `hostinger_full.sql` (2026-05-06, dépréciée), où `social_links` portait les
-- colonnes `current_rank` / `last_interaction` / `rank_updated_at`. Le code
-- déployé (api/*.php), la vue `v_social_links`, la fonction
-- `get_or_create_social_link` et la procédure `add_social_link_xp` attendent
-- désormais `rank` / `created_at` / `last_interaction_at` (cf. `../bdd_mysql.sql`,
-- source de vérité). Aucune migration n'avait capturé ce renommage → tout le
-- sous-système social plantait en prod ("Unknown column 'rank'"), notamment
-- GET /api/admin/users/:id (500).
--
-- Cette migration aligne la prod sur `bdd_mysql.sql` : renomme les colonnes SANS
-- perte de données (CHANGE conserve les valeurs), ajoute `created_at`, retire
-- `rank_updated_at` (inutilisé par le code courant), puis recrée vue + fonction +
-- procédure avec les bons noms.
--
-- ⚠️ NON IDEMPOTENTE — à jouer UNE SEULE FOIS, et uniquement sur une base issue de
--    l'ancienne archive (colonnes `current_rank`/`last_interaction`). Une base déjà
--    au schéma courant (dev/CI via bdd_mysql.sql) ne doit PAS la recevoir.
-- ⚠️ Contient DELIMITER — appliquer via le client mysql en SSH :
--      mysql -u <user> -p <db> < 024_reconcile_social_links_prod_schema.sql
--    (jamais phpMyAdmin, qui ne gère pas DELIMITER). Faire un mysqldump AVANT.

-- 1. Éliminer les last_interaction NULL avant de passer la colonne NOT NULL
UPDATE social_links SET last_interaction = NOW() WHERE last_interaction IS NULL;

-- 2. Renommage / ajout / retrait de colonnes (data-safe)
ALTER TABLE social_links
    CHANGE COLUMN current_rank     `rank`              INT       NOT NULL DEFAULT 1,
    CHANGE COLUMN last_interaction last_interaction_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                                 ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER xp,
    DROP COLUMN IF EXISTS rank_updated_at;

-- 3. Vue v_social_links (recréée avec les nouveaux noms — définition bdd_mysql.sql)
DROP VIEW IF EXISTS v_social_links;
CREATE VIEW v_social_links AS
    SELECT sl.id, sl.user_a_id AS user_id, sl.user_b_id AS friend_id,
           sl.`rank`, sl.xp, sl.created_at, sl.last_interaction_at
    FROM social_links sl
    UNION ALL
    SELECT sl.id, sl.user_b_id AS user_id, sl.user_a_id AS friend_id,
           sl.`rank`, sl.xp, sl.created_at, sl.last_interaction_at
    FROM social_links sl;

-- 4. Fonction + procédure (recréées avec les nouveaux noms — définitions bdd_mysql.sql)
DROP FUNCTION  IF EXISTS get_or_create_social_link;
DROP PROCEDURE IF EXISTS add_social_link_xp;

DELIMITER //

CREATE FUNCTION get_or_create_social_link(id1 BIGINT UNSIGNED, id2 BIGINT UNSIGNED)
RETURNS BIGINT UNSIGNED
DETERMINISTIC
MODIFIES SQL DATA
BEGIN
    DECLARE a_id    BIGINT UNSIGNED;
    DECLARE b_id    BIGINT UNSIGNED;
    DECLARE link_id BIGINT UNSIGNED DEFAULT NULL;

    SET a_id = LEAST(id1, id2);
    SET b_id = GREATEST(id1, id2);

    SELECT id INTO link_id
    FROM social_links
    WHERE user_a_id = a_id AND user_b_id = b_id
    LIMIT 1;

    IF link_id IS NULL THEN
        INSERT INTO social_links (user_a_id, user_b_id) VALUES (a_id, b_id);
        SET link_id = LAST_INSERT_ID();
    END IF;

    RETURN link_id;
END //

CREATE PROCEDURE add_social_link_xp(
    IN  p_link_id    BIGINT UNSIGNED,
    IN  p_xp_amount  INT,
    OUT p_new_xp     INT,
    OUT p_new_rank   INT,
    OUT p_ranked_up  TINYINT(1)
)
BEGIN
    DECLARE v_current_xp   INT;
    DECLARE v_current_rank INT;
    DECLARE v_updated_xp   INT;
    DECLARE v_updated_rank INT;

    SELECT xp, `rank` INTO v_current_xp, v_current_rank
    FROM social_links WHERE id = p_link_id;

    SET v_updated_xp = v_current_xp + p_xp_amount;

    SELECT MAX(r.`rank`) INTO v_updated_rank
    FROM social_link_ranks r
    WHERE r.xp_required <= v_updated_xp;

    IF v_updated_rank IS NULL THEN SET v_updated_rank = 1; END IF;

    SET p_ranked_up = IF(v_updated_rank > v_current_rank, 1, 0);

    UPDATE social_links
    SET xp = v_updated_xp,
        `rank` = v_updated_rank,
        last_interaction_at = NOW()
    WHERE id = p_link_id;

    SET p_new_xp   = v_updated_xp;
    SET p_new_rank = v_updated_rank;
END //

DELIMITER ;
