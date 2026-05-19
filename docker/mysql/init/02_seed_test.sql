-- docker/mysql/init/02_seed_test.sql
-- Données de test pour le développement local avec Docker.
-- Exécuté après 01_schema.sql (qui contient déjà le seed de production :
-- titles, social_link_ranks).
--
-- Ce fichier crée un compte de développement pour tester rapidement
-- sans avoir à s'inscrire via l'UI.
--
-- ⚠️  NE PAS UTILISER EN PRODUCTION — données de test uniquement.

USE personadle_db;

-- Compte développeur de test
-- Email    : dev@personadle.local
-- Password : devpassword123  (bcrypt hash ci-dessous)
-- Généré avec : password_hash('devpassword123', PASSWORD_BCRYPT)
INSERT IGNORE INTO users (email, pseudo, password_hash, friend_code, lang)
VALUES (
    'dev@personadle.local',
    'DevJoker',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'DEV00001',
    'en'
);

-- Profil de base pour le compte dev
INSERT IGNORE INTO profiles (user_id)
SELECT id FROM users WHERE email = 'dev@personadle.local';

-- Stats vides pour chaque mode
INSERT IGNORE INTO user_stats (user_id, mode)
SELECT u.id, m.mode
FROM users u
CROSS JOIN (
    SELECT 'Classic'      AS mode UNION ALL
    SELECT 'Emoji'        UNION ALL
    SELECT 'Silhouette'   UNION ALL
    SELECT 'AllOutAttack' UNION ALL
    SELECT 'Personae'     UNION ALL
    SELECT 'Music'
) m
WHERE u.email = 'dev@personadle.local';
