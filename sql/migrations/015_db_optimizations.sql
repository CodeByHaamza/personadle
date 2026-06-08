-- Migration 015 : Optimisations BDD — nettoyage d'index et ajout d'index manquants

-- Supprimer l'index redondant (doublon de la contrainte UNIQUE uq_pseudo)
-- L'index B-Tree est automatiquement créé par la contrainte UNIQUE — ce doublon
-- occupe de l'espace disque et ralentit les INSERT/UPDATE inutilement.
ALTER TABLE users DROP INDEX idx_users_pseudo;

-- Index composite pour social_link_interactions (requêtes anti-spam fréquentes)
ALTER TABLE social_link_interactions
  ADD INDEX idx_sli_composite (social_link_id, initiator_id, action_type);

-- FK sur social_link_rankup_notifs pour cascade sur hard-delete
-- Empêche les orphelins lorsqu'un utilisateur est définitivement supprimé.
ALTER TABLE social_link_rankup_notifs
  ADD CONSTRAINT fk_slrn_recipient
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_slrn_partner
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE;
