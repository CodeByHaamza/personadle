-- ─────────────────────────────────────────────────────────────────────────────
-- 054 — Contenu 2.3 : quatre badges, un titre, et la table `challenge_wins`
--
-- ── Pourquoi une table pour les défis relevés ───────────────────────────────
-- Le badge « Chord Progression » demande 10 défis d'ami relevés en mode Musique.
-- La donnée existe déjà dans `messages` (type='challenge', status='beaten'),
-- mais elle n'y est pas DURABLE : un joueur a le droit de supprimer ses messages
-- (DELETE /api/messages/:id). Compter les lignes vivantes ferait reperdre le
-- badge à qui range sa boîte de réception — ce que la règle de monotonie
-- interdit (CLAUDE.md §7 : « un accès gagné ne doit jamais se reperdre »).
--
-- `game_sessions` ne peut pas non plus servir : elle n'a aucune colonne disant
-- qu'une partie venait d'un défi, et la session est enregistrée par un appel
-- séparé de celui qui marque le défi relevé.
--
-- D'où une table minuscule, en AJOUT SEUL, écrite par le serveur au moment exact
-- où il valide la transition `accepted → beaten` (api/messages/index.php). C'est
-- le seul endroit où le serveur SAIT — il y vérifie déjà que seul le destinataire
-- peut marquer un défi relevé, et depuis quel état. Rien n'est cru sur parole du
-- client.
--
-- Idempotente : `CREATE TABLE IF NOT EXISTS` et `INSERT IGNORE`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Défis relevés, en ajout seul ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_wins (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED  NOT NULL,
    mode        VARCHAR(30)      NOT NULL,
    is_expert   TINYINT(1)       NOT NULL DEFAULT 0,
    -- Le défi d'origine, pour la traçabilité. Volontairement SANS clé étrangère
    -- ni cascade : le message peut disparaître (suppression par le joueur,
    -- annulation admin) alors que le fait, lui, reste acquis. Une cascade
    -- réintroduirait exactement le problème que cette table résout.
    message_id  BIGINT UNSIGNED  NULL,
    won_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- Un même défi ne compte qu'une fois, même si le client rejoue son PATCH
    -- (file de relance de gameCore.js après un timeout).
    UNIQUE KEY uq_challenge_win (user_id, message_id),
    KEY idx_challenge_wins_user_mode (user_id, mode),
    CONSTRAINT fk_cw_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Les quatre badges de la 2.3 ─────────────────────────────────────────────
--
-- `targets_found` + `condition_mode` = une clé de PERSONADLE_TARGET_SETS
-- (api/lib/condition_check.php). Le serveur relit `game_sessions` : rien n'est
-- accordé sur déclaration du client.
INSERT IGNORE INTO badges
    (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret)
VALUES
    ('chord_progression', 'Chord Progression', 'social', 'epic',
     'profile/badges/images/Badge_Chord_Progression.webp',
     'Beat 10 friend challenges in Music mode',
     'mode_challenge_wins', 'music', 10, 0),

    ('birds_different_feather', 'Birds of a Different Feather', 'achievement', 'rare',
     'profile/badges/images/Badge_Birds_Of_A_Different_Feather.webp',
     'Find Goro Akechi and Kira Kitazato in Silhouette, and Crow and Messa in All-Out Attack',
     'targets_found', 'birds_different_feather', NULL, 0),

    -- Le pendant Persona 3 de « Go Beyond » : les deux protagonistes de P3P dans
    -- les six modes. D'où `legendary`, la deuxième du catalogue.
    ('memento_vivere_mori', 'Memento Vivere, Memento Mori', 'achievement', 'legendary',
     'profile/badges/images/Badge_Memento_Vivere_Memento_Mori.webp',
     'Find Makoto Yuki and Kotone Shiomi in every mode, and their four themes in Music',
     'targets_found', 'memento_vivere_mori', NULL, 0),

    -- Secret : la condition est un CODE, dévoilé dans l'annonce Discord de la
    -- sortie (décision Hamza du 2026-09-23). Même schéma que gyotre/alibaba —
    -- `manual`, et seul /redeem l'accorde (le garde de route de
    -- api/badges/index.php refuse /unlock pour tout badge adossé à un code).
    ('soul_phrase', 'Soul Phrase', 'secret', 'epic',
     'profile/badges/images/Badge_Kotone_Orpheus.webp',
     '???',
     'manual', NULL, NULL, 1);

INSERT IGNORE INTO event_codes
    (code, badge_id, start_date, end_date, is_permanent, is_active, description)
VALUES
    ('SOULPHRASE', 'soul_phrase', NULL, NULL, 1, 1, 'Secret 2.3 — Kotone (annonce Discord)');

-- ── Le titre Déjà Vu ────────────────────────────────────────────────────────
-- Persona 2 est une duologie où le même duo revient d'un jeu à l'autre : le
-- titre demande donc littéralement de LES RETROUVER, Tatsuya et Maya, dans deux
-- modes différents.
INSERT IGNORE INTO titles
    (slug, image_path, name_en, name_fr, name_es, name_de, name_it, name_pt,
     description_en, description_fr,
     condition_type, condition_mode, condition_value, rarity)
VALUES
    ('tatsuya_maya_deja_vu', 'profile/titles/tatsuya_maya_deja_vu.webp',
     'Déjà Vu', 'Déjà Vu', 'Déjà Vu', 'Déjà Vu', 'Déjà Vu', 'Déjà Vu',
     'Find Tatsuya Suou and Maya Amano in both Classic and Silhouette.',
     'Trouve Tatsuya Suou et Maya Amano en Classique ET en Silhouette.',
     'targets_found', 'p2_deja_vu', NULL, 'epic');
