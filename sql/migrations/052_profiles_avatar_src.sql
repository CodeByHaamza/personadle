-- ─────────────────────────────────────────────────────────────────────────────
-- 052 — profiles.avatar_src : retenir QUEL portrait de la galerie le joueur porte,
--       même une fois recadré
--
-- Signalé le 2026-09-19 : « je suis pas sûr que le badge Same Energy se
-- débloque bien ». Il ne pouvait presque jamais : choisir un portrait ouvre
-- aussitôt la fenêtre de recadrage, et valider remplace `avatar_data`
-- (`../img/avatar/Chie.jpg`) par le PNG recadré en base64. Le serveur
-- (personadle_same_energy_partners) ne reconnaît alors plus ni Chie ni Arai —
-- le badge ne tombait que si les DEUX amis avaient fermé la fenêtre sans
-- recadrer. Le client gardait bien le chemin d'origine (`profile.avatarSrc`),
-- mais uniquement en local : il n'était pas synchronisé, et le pull cloud
-- l'effaçait.
--
-- `avatar_src` = chemin galerie d'origine (`../img/avatar/<fichier>`), ou NULL
-- pour un avatar absent. Le PATCH le déduit lui-même quand `avatar_data` est
-- un chemin galerie ; le client l'envoie quand il recadre. Toute logique qui
-- doit savoir « qui » le joueur porte lit `avatar_src` en priorité.
--
-- Reprise : les portraits non recadrés se reconnaissent à `avatar_data` ; un
-- portrait recadré avant cette migration reste inconnu (NULL) — le joueur le
-- re-choisit une fois dans l'Atelier et c'est réglé.
--
-- Idempotente (MariaDB `IF NOT EXISTS`, UPDATE borné par `avatar_src IS NULL`).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS avatar_src VARCHAR(120) NULL AFTER avatar_data;

UPDATE profiles
   SET avatar_src = avatar_data
 WHERE avatar_src IS NULL
   AND avatar_data LIKE '../img/avatar/%'
   AND CHAR_LENGTH(avatar_data) <= 120;
