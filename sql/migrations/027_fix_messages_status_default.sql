-- 027 — Corrige le défaut de messages.status ('pending' → 'unread').
--
-- CONTEXTE : la base prod (archive du 6 mai) avait `messages.status` avec
-- DEFAULT 'pending', alors que le code attend 'unread' (valeurs valides côté
-- code : unread/read/accepted/beaten/expired — jamais 'pending'). Les défis,
-- créés sans statut explicite, héritaient donc de 'pending' → le poller de
-- notifications (js/notifications.js, filtre status === 'unread') ne les voyait
-- jamais → aucune notif de défi (alors que les demandes d'ami, via
-- friendships.seen_at, fonctionnaient). Découvert le 2026-07-24.
--
-- Le code (api/messages/index.php) force désormais status='unread' à l'INSERT
-- (ne dépend plus du défaut). Cette migration aligne aussi le défaut en prod
-- pour cohérence avec bdd_mysql.sql, et corrige d'éventuelles lignes 'pending'.

ALTER TABLE messages ALTER COLUMN status SET DEFAULT 'unread';

UPDATE messages SET status = 'unread' WHERE status = 'pending';
