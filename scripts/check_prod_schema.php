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

if ($drift === 0) {
    echo "✅ Aucune dérive : toutes les colonnes attendues par bdd_mysql.sql sont présentes.\n";
    exit(0);
}

echo "\n⚠️  $drift table(s) en dérive. Écrire une migration de reconciliation (cf. sql/migrations/024, 025).\n";
exit(1);
