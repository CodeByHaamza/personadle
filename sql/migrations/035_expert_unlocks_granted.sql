-- =============================================================================
-- 035 — Déblocage manuel d'un Mode Expert par un admin
-- =============================================================================
-- Complète la porte d'entrée du Mode Expert (api/lib/expert_unlocks.php), qui
-- jusqu'ici ne savait débloquer qu'en calculant depuis `game_sessions` : un
-- joueur ne pouvait obtenir l'accès qu'en remplissant lui-même la condition.
--
-- Pourquoi une table dédiée plutôt que d'injecter de fausses parties dans
-- `game_sessions` : ces parties compteraient dans les stats du joueur, dans les
-- classements et dans les badges `mode_wins`/`games_total`. Un geste d'admin ne
-- doit rien fabriquer qui ressemble à du jeu réel. Même raisonnement que
-- `badges_unlocked`, dont cette table reprend la forme.
--
-- Le déblocage manuel est un OU avec la condition calculée, jamais un
-- remplacement : un joueur qui remplit la condition normalement n'a pas besoin
-- de ligne ici, et retirer la ligne ne lui retire pas l'accès qu'il a gagné.
--
-- `mode` n'a pas de contrainte d'énumération : les 6 modes vivent dans
-- api/lib/expert_unlocks.php (source unique), et un ENUM SQL forcerait une
-- migration à chaque nouveau mode. La validation se fait côté PHP, contre
-- personadle_expert_conditions().
--
-- Idempotente (IF NOT EXISTS) : rejouable sans effet de bord.
--
-- ⚠️ MariaDB : `CREATE TABLE IF NOT EXISTS` est standard et passe aussi sur
-- MySQL 8.0 — contrairement à `ADD COLUMN IF NOT EXISTS` utilisé par les
-- migrations 031/032, qui lui est spécifique à MariaDB.
-- =============================================================================

CREATE TABLE IF NOT EXISTS expert_unlocks_granted (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED  NOT NULL,
    mode        VARCHAR(30)      NOT NULL,   -- 'classic' | 'emoji' | 'silhouette' | 'alloutattack' | 'personae' | 'music'
    -- NULL si l'admin qui a accordé le déblocage a depuis supprimé son compte :
    -- la trace du déblocage doit survivre au départ de celui qui l'a accordé.
    granted_by  BIGINT UNSIGNED  NULL,
    granted_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- Un seul déblocage par (joueur, mode) : accorder deux fois est un no-op,
    -- ce qui rend l'endpoint admin naturellement idempotent.
    UNIQUE KEY uq_expert_grant (user_id, mode),
    -- Types alignés sur users.id (BIGINT UNSIGNED), vérifié avant l'ADD
    -- CONSTRAINT comme l'exige CLAUDE.md §13.
    CONSTRAINT fk_expert_grant_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_expert_grant_admin   FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
