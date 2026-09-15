-- =============================================================================
-- 041 — La suite des essais d'une partie (game_sessions.guesses)
-- =============================================================================
-- « Comparer nos parties » (2.2, décision Hamza du 2026-09-13) : après sa partie
-- du jour, un joueur voit comment ses amis ont trouvé la même cible — leur suite
-- d'essais, pas seulement leur nombre. La colonne stocke la liste ordonnée des
-- noms proposés, le bon en dernier si la partie est gagnée :
--   ["Yosuke Hanamura", "Kanji Tatsumi", "Yu Narukami"]
--
-- Seule la PREMIÈRE partie du jour (par joueur, mode, is_expert) est comparée —
-- les replays sont enregistrés avec leurs essais aussi, mais api/sessions/today.php
-- ne lit que MIN(id). NULL = partie enregistrée avant cette migration, ou par un
-- client qui n'envoie pas encore la liste : la comparaison montre alors le
-- nombre d'essais seul.
--
-- ⚠️ Syntaxe MariaDB (`ADD COLUMN IF NOT EXISTS`), comme 031/032/037/040.
-- Idempotente : rejouable sans effet de bord.
-- =============================================================================

ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS guesses JSON NULL
    AFTER active_filters;
