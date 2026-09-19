<?php
/**
 * scripts/check_prod_schema.php — Détecteur de dérive de schéma BDD.
 *
 * Compare le schéma RÉEL de la base (information_schema) à la source de vérité
 * sql/bdd_mysql.sql, et liste les colonnes attendues MANQUANTES par table
 * (celles qui provoquent des 500 "Unknown column").
 *
 * À lancer sur le serveur (utilise api/config.php) depuis la racine du repo :
 *     php scripts/check_prod_schema.php
 *
 * Exit 0 si aucune dérive, 1 sinon. Peut se brancher en cron pour surveiller.
 * Né de l'incident du 2026-07-24 (prod montée depuis une vieille archive → 500
 * en série ; cf. migrations 024/025 et DEV_CHANGELOG).
 *
 * NB : ne signale que les colonnes MANQUANTES (dangereuses). Les colonnes EN PLUS
 *      côté prod sont inoffensives et volontairement ignorées.
 *
 * Depuis le 2026-09-19, compare AUSSI les contraintes UNIQUE : une contrainte
 * présente en prod mais absente de la référence refuse des écritures que le code
 * croit permises. Vécu : `game_sessions.uq_session (user_id, mode, played_date)`,
 * jamais supprimée parce que la migration 032 visait le nom de la référence
 * (`uq_session_per_day`) — chaque rejeu et chaque partie Expert du même jour
 * tombaient en 409 « déjà enregistrée » pendant dix-huit jours, sans un log.
 */

$root = dirname(__DIR__);
require $root . '/api/config.php';

// ── 1. Colonnes attendues, extraites de bdd_mysql.sql ────────────────────────
$sql = file_get_contents($root . '/sql/bdd_mysql.sql');
preg_match_all('/CREATE TABLE\s+`?(\w+)`?\s*\((.*?)\n\)\s*ENGINE/is', $sql, $blocks, PREG_SET_ORDER);

$KEYWORDS = '/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|INDEX|CHECK|ON)\b/i';
$expected = [];
foreach ($blocks as $b) {
    $cols = [];
    foreach (explode("\n", $b[2]) as $line) {
        $line = trim($line);
        if ($line === '' || preg_match($KEYWORDS, $line)) continue;
        if (preg_match('/^`?(\w+)`?\s+\S/', $line, $cm)) {
            $cols[] = $cm[1];
        }
    }
    $expected[$b[1]] = $cols;
}

// ── 1b. Contraintes UNIQUE attendues — par colonnes, sans le nom : la prod peut
//        porter la même contrainte sous un autre nom, c'est même le piège ──────
$expectedUnique = [];
foreach ($blocks as $b) {
    foreach (explode("\n", $b[2]) as $line) {
        $line = trim($line);
        if (preg_match('/^UNIQUE\s+(?:KEY|INDEX)?\s*`?\w*`?\s*\(([^)]+)\)/i', $line, $um)) {
            $expectedUnique[$b[1]][] = preg_replace('/[`\s]/', '', $um[1]);
        }
        // La clé primaire de la référence compte aussi : les 025/048 ont posé l'`id`
        // AUTO_INCREMENT de prod en UNIQUE KEY (la PK composite d'origine restant) —
        // même garantie que la référence, pas une dérive.
        if (preg_match('/^PRIMARY\s+KEY\s*\(([^)]+)\)/i', $line, $pm)) {
            $expectedUnique[$b[1]][] = preg_replace('/[`\s]/', '', $pm[1]);
        }
    }
}

// ── 2. Colonnes réelles (information_schema) ─────────────────────────────────
$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$rows = $pdo->query(
    'SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = DATABASE()'
)->fetchAll(PDO::FETCH_ASSOC);

$actual = [];
foreach ($rows as $r) {
    $actual[$r['table_name']][] = $r['column_name'];
}

// ── 3. Diff : tables/colonnes attendues absentes de la prod ──────────────────
$drift = 0;
foreach ($expected as $table => $cols) {
    if (!isset($actual[$table])) {
        echo "⛔ TABLE MANQUANTE : $table\n";
        $drift++;
        continue;
    }
    $missing = array_values(array_diff($cols, $actual[$table]));
    if ($missing) {
        echo "🔴 $table — colonnes manquantes : " . implode(', ', $missing) . "\n";
        $drift++;
    }
}

// ── 3b. Contraintes UNIQUE en prod que la référence n'a pas ──────────────────
$uniqueRows = $pdo->query(
    "SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND non_unique = 0 AND index_name <> 'PRIMARY'
     GROUP BY table_name, index_name"
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($uniqueRows as $u) {
    if (!isset($expected[$u['table_name']])) continue; // table propre à la prod : hors périmètre
    $wanted = $expectedUnique[$u['table_name']] ?? [];
    if (!in_array($u['cols'], $wanted, true)) {
        echo "🔴 {$u['table_name']} — contrainte UNIQUE en trop : {$u['index_name']} ({$u['cols']}) "
           . "— la référence ne l'a pas : elle refuse des écritures que le code croit permises\n";
        $drift++;
    }
}

if ($drift === 0) {
    echo "✅ Aucune dérive : colonnes et contraintes UNIQUE conformes à bdd_mysql.sql.\n";
    exit(0);
}

echo "\n⚠️  $drift table(s) en dérive. Écrire une migration de reconciliation (cf. sql/migrations/024, 025).\n";
exit(1);
