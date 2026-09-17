-- =============================================================================
-- 040 — Mode favori choisi par le joueur (profiles.favorite_mode)
-- =============================================================================
-- Jusqu'ici le « Mode favori » du profil était calculé : le mode le plus joué,
-- recalculé à chaque partie (profile/profileStats.js, js/cloud-sync.js). Retour
-- joueur 2.2 : le joueur veut le CHOISIR lui-même — et le mode où il performe le
-- mieux reste affiché à côté, sous l'intitulé « Best Mode Overall », calculé à
-- l'affichage (meilleur taux de victoire, 3 parties minimum).
--
-- ── Pourquoi une colonne et non une clé dans profiles.settings ───────────────
-- `settings` est le JSON privé des préférences (son, animations, autoplay) — il
-- n'est jamais renvoyé par api/user/public.php. Le mode favori, lui, se voit sur
-- le profil visité par les amis, comme le titre équipé ou la bordure d'avatar :
-- même statut, même endroit.
--
-- Valeurs : clé canonique de mode (classic, emoji, silhouette, alloutattack,
-- personae, music) ou NULL = pas de choix (le profil affiche « — »). Validée
-- côté serveur dans api/user/index.php (PATCH), jamais côté client seul.
--
-- ⚠️ Syntaxe MariaDB (`ADD COLUMN IF NOT EXISTS`), comme les migrations 031/032/037.
-- MySQL 8.0 la refuse. La prod tourne en MariaDB 10.6.
--
-- Idempotente : rejouable sans effet de bord.
-- =============================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS favorite_mode VARCHAR(20) NULL
    AFTER equipped_title_id;
