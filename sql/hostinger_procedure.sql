-- =============================================================================
-- PersonaDLE — Procédure stockée gain_social_link_xp
-- =============================================================================
-- À importer APRÈS hostinger_full.sql via PhpMyAdmin.
--
-- Dans PhpMyAdmin : onglet Importer → champ "Délimiteur" → changer ; en $$
-- puis importer ce fichier.
-- =============================================================================

DROP PROCEDURE IF EXISTS gain_social_link_xp$$

CREATE PROCEDURE gain_social_link_xp(
    IN p_user_a    BIGINT,
    IN p_user_b    BIGINT,
    IN p_action    VARCHAR(50),
    IN p_xp_base   INT,
    OUT p_ranked_up TINYINT,
    OUT p_new_rank  INT
)
proc_body: BEGIN
    DECLARE v_link_id    BIGINT;
    DECLARE v_old_rank   INT;
    DECLARE v_new_rank   INT;
    DECLARE v_new_xp     INT;
    DECLARE v_is_mutual  TINYINT DEFAULT 0;
    DECLARE v_xp_gained  INT;
    DECLARE v_cutoff     TIMESTAMP;
    DECLARE v_exists     INT;
    DECLARE a_id         BIGINT;
    DECLARE b_id         BIGINT;

    SET p_ranked_up = 0;
    SET p_new_rank  = 0;

    -- Canonicaliser : user_a = plus petit id
    IF p_user_a < p_user_b THEN SET a_id = p_user_a; SET b_id = p_user_b;
    ELSE                        SET a_id = p_user_b; SET b_id = p_user_a;
    END IF;

    -- Créer le Social Link s'il n'existe pas
    INSERT IGNORE INTO social_links (user_a_id, user_b_id) VALUES (a_id, b_id);
    SELECT id, current_rank, xp INTO v_link_id, v_old_rank, v_new_xp
    FROM social_links WHERE user_a_id = a_id AND user_b_id = b_id;

    -- Anti-spam : une même action ne peut rapporter de l'XP qu'une fois par heure
    SET v_cutoff = DATE_SUB(NOW(), INTERVAL 1 HOUR);
    SELECT COUNT(*) INTO v_exists
    FROM social_link_interactions
    WHERE social_link_id = v_link_id
      AND initiator_id   = p_user_a
      AND action_type    = p_action
      AND created_at     > v_cutoff;

    IF v_exists > 0 THEN LEAVE proc_body; END IF;

    -- Détecter si l'autre joueur a fait la même action récemment (mutuel)
    SELECT COUNT(*) INTO v_is_mutual
    FROM social_link_interactions
    WHERE social_link_id = v_link_id
      AND initiator_id   = p_user_b
      AND action_type    = p_action
      AND created_at     > DATE_SUB(NOW(), INTERVAL 24 HOUR);

    SET v_xp_gained = IF(v_is_mutual, p_xp_base * 2, p_xp_base);
    SET v_new_xp    = v_new_xp + v_xp_gained;

    -- Log l'interaction
    INSERT INTO social_link_interactions (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
    VALUES (v_link_id, p_user_a, p_action, v_xp_gained, v_is_mutual);

    -- Calculer le nouveau rang
    SELECT COALESCE(MAX(`rank`), 1) INTO v_new_rank
    FROM social_link_ranks
    WHERE xp_required <= v_new_xp;

    -- Mettre à jour social_links
    UPDATE social_links
    SET xp               = v_new_xp,
        current_rank     = v_new_rank,
        last_interaction = NOW(),
        rank_updated_at  = IF(v_new_rank > v_old_rank, NOW(), rank_updated_at)
    WHERE id = v_link_id;

    SET p_ranked_up = IF(v_new_rank > v_old_rank, 1, 0);
    SET p_new_rank  = v_new_rank;
END$$
