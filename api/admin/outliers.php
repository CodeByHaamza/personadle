<?php
/**
 * GET /api/admin/outliers?days=30
 *
 * Comptes hors norme (2.4, lot 16) : signaux statistiques sur les parties
 * normales de la période — rejeu en masse, victoires du premier coup trop
 * fréquentes, quasi aucun abandon, victoires éclair. Des pistes pour l'admin,
 * pas des preuves ni des sanctions. Logique et seuils : api/lib/outliers.php.
 * Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/outliers.php';

requireAdmin();
$days = max(1, min(365, (int) ($_GET['days'] ?? 30)));

jsonSuccess(['days' => $days, 'users' => personadle_find_outliers(pdo(), $days)]);
