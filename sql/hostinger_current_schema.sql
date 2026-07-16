/*M!999999\- enable the sandbox mode */ 
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_audit_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `target_type` varchar(40) NOT NULL,
  `target_id` varchar(100) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_admin_audit_log_created` (`created_at` DESC),
  KEY `idx_admin_audit_log_target` (`target_type`,`target_id`),
  KEY `idx_admin_audit_log_admin` (`admin_id`,`created_at` DESC),
  CONSTRAINT `fk_admin_audit_log_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `badges` (
  `slug` varchar(100) NOT NULL,
  `name_en` varchar(200) NOT NULL,
  `name_fr` varchar(200) NOT NULL DEFAULT '',
  `name_es` varchar(200) NOT NULL DEFAULT '',
  `name_de` varchar(200) NOT NULL DEFAULT '',
  `name_it` varchar(200) NOT NULL DEFAULT '',
  `category` enum('achievement','streak','event','secret','social') NOT NULL DEFAULT 'achievement',
  `rarity` enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
  `image_path` varchar(255) NOT NULL DEFAULT '',
  `condition_en` varchar(500) NOT NULL DEFAULT '',
  `condition_type` varchar(50) DEFAULT NULL,
  `condition_mode` varchar(30) DEFAULT NULL,
  `condition_value` int(11) DEFAULT NULL,
  `is_secret` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `badges_unlocked` (
  `user_id` bigint(20) unsigned NOT NULL,
  `badge_id` varchar(100) NOT NULL,
  `unlocked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`badge_id`),
  CONSTRAINT `badges_unlocked_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `deletion_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  `deletion_type` varchar(20) NOT NULL DEFAULT 'full',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `error_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `level` varchar(20) NOT NULL DEFAULT 'error',
  `message` text NOT NULL,
  `context` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`context`)),
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_error_log_user` (`user_id`),
  KEY `idx_error_log_created` (`created_at` DESC),
  KEY `idx_error_log_level` (`level`,`created_at` DESC),
  CONSTRAINT `fk_error_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_codes` (
  `code` varchar(50) NOT NULL,
  `badge_id` varchar(100) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `is_permanent` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`code`),
  KEY `idx_event_codes_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_codes_redeemed` (
  `user_id` bigint(20) unsigned NOT NULL,
  `code` varchar(50) NOT NULL,
  `redeemed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`code`),
  CONSTRAINT `event_codes_redeemed_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `friendships` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `requester_id` bigint(20) unsigned NOT NULL,
  `addressee_id` bigint(20) unsigned NOT NULL,
  `status` enum('pending','accepted','blocked') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `seen_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_friendship` (`requester_id`,`addressee_id`),
  KEY `addressee_id` (`addressee_id`),
  CONSTRAINT `friendships_ibfk_1` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_ibfk_2` FOREIGN KEY (`addressee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `mode` varchar(30) NOT NULL,
  `played_date` date NOT NULL,
  `target_name` varchar(200) NOT NULL,
  `result` enum('win','loss','giveup') NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `time_ms` int(11) NOT NULL DEFAULT 0,
  `active_filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`active_filters`)),
  `perfect_win` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session` (`user_id`,`mode`,`played_date`),
  UNIQUE KEY `uq_session_per_day` (`user_id`,`mode`,`played_date`),
  KEY `idx_game_sessions_user_mode` (`user_id`,`mode`),
  KEY `idx_game_sessions_date` (`played_date`),
  KEY `idx_game_sessions_target` (`mode`,`played_date`,`target_name`),
  KEY `idx_gs_user_mode_date` (`user_id`,`mode`,`played_date`),
  CONSTRAINT `game_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `leaderboard_cache` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `mode` varchar(30) NOT NULL,
  `period` varchar(15) NOT NULL,
  `metric` varchar(20) NOT NULL DEFAULT 'wins',
  `score` int(11) NOT NULL DEFAULT 0,
  `rank_position` int(11) DEFAULT NULL,
  `period_start` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leaderboard` (`user_id`,`mode`,`period`,`metric`,`period_start`),
  KEY `idx_leaderboard_ranking` (`mode`,`period`,`metric`,`period_start`,`score` DESC),
  CONSTRAINT `leaderboard_cache_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` bigint(20) unsigned NOT NULL,
  `receiver_id` bigint(20) unsigned NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'message',
  `content` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `challenge_mode` varchar(30) DEFAULT NULL,
  `challenge_date` date DEFAULT NULL,
  `challenge_filters` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_messages_receiver` (`receiver_id`,`status`,`created_at` DESC),
  KEY `idx_messages_sender_type` (`sender_id`,`type`,`status`,`created_at` DESC),
  KEY `idx_messages_sender` (`sender_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `avatar_data` mediumtext DEFAULT NULL,
  `avatar_border_color` varchar(7) NOT NULL DEFAULT '#ffffff',
  `wallpaper_id` varchar(100) DEFAULT NULL,
  `profile_music_id` varchar(100) DEFAULT NULL,
  `selected_badges` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`selected_badges`)),
  `equipped_title_id` bigint(20) unsigned DEFAULT NULL,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  KEY `equipped_title_id` (`equipped_title_id`),
  CONSTRAINT `profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `profiles_ibfk_2` FOREIGN KEY (`equipped_title_id`) REFERENCES `titles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rate_limits` (
  `rl_key` varchar(191) NOT NULL,
  `hits` int(11) NOT NULL DEFAULT 0,
  `window_start` int(11) NOT NULL,
  PRIMARY KEY (`rl_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_link_badge_configs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `social_link_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `avatar_data` mediumtext DEFAULT NULL,
  `crop_x` float NOT NULL DEFAULT 0,
  `crop_y` float NOT NULL DEFAULT 0,
  `crop_scale` float NOT NULL DEFAULT 1,
  `ring_color` varchar(7) NOT NULL DEFAULT '#f5c842',
  `bg_color` varchar(7) DEFAULT NULL,
  `overlay` varchar(20) NOT NULL DEFAULT 'none',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slbc` (`social_link_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `social_link_badge_configs_ibfk_1` FOREIGN KEY (`social_link_id`) REFERENCES `social_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `social_link_badge_configs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_link_interactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `social_link_id` bigint(20) unsigned NOT NULL,
  `initiator_id` bigint(20) unsigned NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `xp_gained` int(11) NOT NULL DEFAULT 0,
  `is_mutual` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `initiator_id` (`initiator_id`),
  KEY `idx_sli_composite` (`social_link_id`,`initiator_id`,`action_type`),
  CONSTRAINT `social_link_interactions_ibfk_1` FOREIGN KEY (`social_link_id`) REFERENCES `social_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `social_link_interactions_ibfk_2` FOREIGN KEY (`initiator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_link_ranks` (
  `rank` int(11) NOT NULL,
  `name_en` varchar(50) NOT NULL,
  `name_fr` varchar(50) NOT NULL DEFAULT '',
  `name_es` varchar(50) NOT NULL DEFAULT '',
  `name_de` varchar(50) NOT NULL DEFAULT '',
  `name_it` varchar(50) NOT NULL DEFAULT '',
  `xp_required` int(11) NOT NULL DEFAULT 0,
  `reward_en` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_link_rankup_notifs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recipient_id` bigint(20) unsigned NOT NULL,
  `partner_id` bigint(20) unsigned NOT NULL,
  `new_rank` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `seen_at` timestamp NULL DEFAULT NULL,
  `is_badge_prompt` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_recipient_unseen` (`recipient_id`,`seen_at`),
  KEY `fk_slrn_partner` (`partner_id`),
  CONSTRAINT `fk_slrn_partner` FOREIGN KEY (`partner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_slrn_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_links` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_a_id` bigint(20) unsigned NOT NULL,
  `user_b_id` bigint(20) unsigned NOT NULL,
  `current_rank` int(11) NOT NULL DEFAULT 1,
  `xp` int(11) NOT NULL DEFAULT 0,
  `last_interaction` timestamp NULL DEFAULT NULL,
  `rank_updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_social_link` (`user_a_id`,`user_b_id`),
  KEY `user_b_id` (`user_b_id`),
  CONSTRAINT `social_links_ibfk_1` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `social_links_ibfk_2` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `titles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL,
  `name_en` varchar(200) NOT NULL,
  `name_fr` varchar(200) NOT NULL DEFAULT '',
  `name_es` varchar(200) NOT NULL DEFAULT '',
  `name_de` varchar(200) NOT NULL DEFAULT '',
  `name_it` varchar(200) NOT NULL DEFAULT '',
  `condition_type` varchar(50) NOT NULL DEFAULT 'wins_total',
  `condition_value` int(11) NOT NULL DEFAULT 0,
  `rarity` enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
  `image_path` varchar(150) DEFAULT NULL,
  `condition_mode` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_stats` (
  `user_id` bigint(20) unsigned NOT NULL,
  `mode` varchar(30) NOT NULL,
  `wins` int(11) NOT NULL DEFAULT 0,
  `giveups` int(11) NOT NULL DEFAULT 0,
  `games` int(11) NOT NULL DEFAULT 0,
  `streak` int(11) NOT NULL DEFAULT 0,
  `streak_record` int(11) NOT NULL DEFAULT 0,
  `perfect_wins` int(11) NOT NULL DEFAULT 0,
  `total_time_ms` bigint(20) NOT NULL DEFAULT 0,
  `last_played_at` timestamp NULL DEFAULT NULL,
  `first_played_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`,`mode`),
  CONSTRAINT `user_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_titles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `title_id` bigint(20) unsigned NOT NULL,
  `unlocked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`title_id`),
  KEY `title_id` (`title_id`),
  CONSTRAINT `user_titles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_titles_ibfk_2` FOREIGN KEY (`title_id`) REFERENCES `titles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_wallpapers` (
  `user_id` bigint(20) unsigned NOT NULL,
  `wallpaper_id` varchar(64) NOT NULL,
  `unlocked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`wallpaper_id`),
  KEY `fk_uw_wallpaper` (`wallpaper_id`),
  CONSTRAINT `fk_uw_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uw_wallpaper` FOREIGN KEY (`wallpaper_id`) REFERENCES `wallpapers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `pseudo` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `friend_code` varchar(8) NOT NULL,
  `lang` varchar(5) NOT NULL DEFAULT 'en',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_banned` tinyint(1) NOT NULL DEFAULT 0,
  `pseudo_locked` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `has_migrated` tinyint(1) NOT NULL DEFAULT 0,
  `remember_me_hash` varchar(64) DEFAULT NULL,
  `remember_me_expires` timestamp NULL DEFAULT NULL,
  `global_streak` int(11) NOT NULL DEFAULT 0,
  `global_streak_record` int(11) NOT NULL DEFAULT 0,
  `global_streak_date` date DEFAULT NULL,
  `reset_token_hash` varchar(64) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `streak_recovered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `pseudo` (`pseudo`),
  UNIQUE KEY `friend_code` (`friend_code`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_code` (`friend_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_friends` AS SELECT
 NULL AS `id`,
 NULL AS `user_a_id`,
 NULL AS `user_b_id`,
 NULL AS `status`,
 NULL AS `created_at`,
 NULL AS `updated_at` */;
SET character_set_client = @saved_cs_client;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_global_stats` AS SELECT
 NULL AS `user_id`,
 NULL AS `pseudo`,
 NULL AS `total_wins`,
 NULL AS `total_games`,
 NULL AS `best_streak` */;
SET character_set_client = @saved_cs_client;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_social_links` AS SELECT
 NULL AS `id`,
 NULL AS `user_a_id`,
 NULL AS `user_b_id`,
 NULL AS `current_rank`,
 NULL AS `xp`,
 NULL AS `last_interaction`,
 NULL AS `rank_updated_at` */;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallpapers` (
  `id` varchar(64) NOT NULL,
  `name` varchar(200) NOT NULL DEFAULT '',
  `game` varchar(16) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `unlock_condition` varchar(255) DEFAULT NULL,
  `condition_type` varchar(50) DEFAULT NULL,
  `condition_mode` varchar(30) DEFAULT NULL,
  `condition_value` int(11) DEFAULT NULL,
  `image_path` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50001 DROP VIEW IF EXISTS `v_friends`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_uca1400_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`u870779941_Hamza`@`127.0.0.1` SQL SECURITY DEFINER */
/*!50001 VIEW `v_friends` AS select `f`.`id` AS `id`,`f`.`requester_id` AS `user_a_id`,`f`.`addressee_id` AS `user_b_id`,`f`.`status` AS `status`,`f`.`created_at` AS `created_at`,`f`.`updated_at` AS `updated_at` from `friendships` `f` where `f`.`status` = 'accepted' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `v_global_stats`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_uca1400_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`u870779941_Hamza`@`127.0.0.1` SQL SECURITY DEFINER */
/*!50001 VIEW `v_global_stats` AS select `u`.`id` AS `user_id`,`u`.`pseudo` AS `pseudo`,sum(`s`.`wins`) AS `total_wins`,sum(`s`.`games`) AS `total_games`,max(`s`.`streak_record`) AS `best_streak` from (`users` `u` join `user_stats` `s` on(`s`.`user_id` = `u`.`id`)) where `u`.`is_deleted` = 0 group by `u`.`id`,`u`.`pseudo` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `v_social_links`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_uca1400_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`u870779941_Hamza`@`127.0.0.1` SQL SECURITY DEFINER */
/*!50001 VIEW `v_social_links` AS select `sl`.`id` AS `id`,least(`sl`.`user_a_id`,`sl`.`user_b_id`) AS `user_a_id`,greatest(`sl`.`user_a_id`,`sl`.`user_b_id`) AS `user_b_id`,`sl`.`current_rank` AS `current_rank`,`sl`.`xp` AS `xp`,`sl`.`last_interaction` AS `last_interaction`,`sl`.`rank_updated_at` AS `rank_updated_at` from `social_links` `sl` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
