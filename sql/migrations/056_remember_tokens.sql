-- ════════════════════════════════════════════════════════════════════════════
-- 056 — « Se souvenir de moi » : un jeton PAR APPAREIL
--
-- Signalement joueur 2026-11 : des déconnexions « automatiques ». Il n'existait
-- qu'un jeton par compte (`users.remember_me_hash`) : chaque connexion
-- l'écrasait, et chaque restauration de session le faisait tourner. Un deuxième
-- appareil — ou deux onglets qui restauraient au même moment — invalidait celui
-- de l'autre, et le joueur se retrouvait invité sans le savoir, avec une autre
-- cible du jour (la graine du tirage passe de son id à un id anonyme).
--
-- Une ligne par appareil. Le hash SHA-256 du jeton brut (jamais le brut), en
-- VARCHAR(64) utf8mb4 comme l'ancienne colonne — comparé à un paramètre lié, il
-- a déjà fait ses preuves sur la MariaDB d'Hostinger (cf. CLAUDE.md §7,
-- collations). Les dates en DATETIME, calculées par la base (NOW() + INTERVAL) :
-- pas de TIMESTAMP sans défaut, que MariaDB peut mettre à jour tout seul.
--
-- Reprise : les jetons encore valides de `users` sont recopiés, pour que les
-- joueurs connectés au moment du déploiement ne soient pas déconnectés. Les
-- colonnes `users.remember_me_*` restent (plus lues) ; à retirer dans une
-- migration ultérieure, une fois cette version livrée.
--
-- Idempotente : `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` (clé unique sur
-- le hash), rejouable sans effet de bord.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS remember_tokens (
    id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED  NOT NULL,
    token_hash   VARCHAR(64)      NOT NULL,
    created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME         NULL,
    expires_at   DATETIME         NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_remember_token_hash (token_hash),
    KEY idx_remember_tokens_user (user_id),
    CONSTRAINT fk_remember_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO remember_tokens (user_id, token_hash, expires_at)
SELECT id, remember_me_hash, remember_me_expires
FROM users
WHERE remember_me_hash IS NOT NULL
  AND remember_me_expires > NOW()
  AND is_deleted = 0;
