<?php
/**
 * api/lib/daily_target.php — Recalcule côté serveur la cible quotidienne attendue
 * pour un joueur/mode/date donné, à partir des mêmes pools que le client
 * (js/gameCore.js) et du même algorithme de tirage (FNV-1a 32 bits seedé).
 *
 * Portage exact de getDailyTarget() (js/gameCore.js) : le hash FNV-1a n'est
 * calculé que sur des caractères ASCII (seedId numérique, date ISO, nom de mode
 * ASCII), donc ord() par octet est équivalent à charCodeAt() par unité UTF-16 —
 * aucune conversion multi-octet à gérer ici.
 *
 * Les pools eux-mêmes viennent de api/data/daily_pools.json, généré par
 * scripts/export-daily-pools.js à partir des datasets JS (source de vérité).
 * `npm run pools:check` (câblé en CI) échoue si ce fichier dérive des sources.
 *
 * ⚠️ LIMITATION CONNUE (revue PR #13) — AllOutAttack et Personae acceptent
 * `$activeFilters` tel que soumis par le client, sans le corréler à un état
 * connu côté serveur (aucune session ne mémorise le filtre opus réellement
 * actif). Un client peut donc soumettre n'importe quel sous-ensemble des
 * codes opus pour faire correspondre le recalcul serveur au nom qu'il veut
 * faire valider — contrairement à Classic/Emoji/Silhouette/Music, qui n'ont
 * pas ce repli filtré et ne sont donc pas contournables de cette façon. Sans
 * conséquence tant que la phase 1 (détection, voir api/sessions.php) reste en
 * mode logging seul ; à résoudre (filtre stocké côté serveur plutôt que
 * re-soumis par le client) avant d'activer un rejet strict pour ces 2 modes
 * spécifiquement — voir ROADMAP.md § Sécurité/compte.
 */

/**
 * @return int Index dans un pool de longueur $poolLen (identique à
 *             `h % pool.length` dans js/gameCore.js::getDailyTarget()).
 */
function personadle_fnv1a_index(string $seedId, string $date, string $mode, int $poolLen): int
{
    $str = "$seedId|$date|$mode";
    $h = 2166136261; // FNV-1a offset basis (32 bits)
    $len = strlen($str);
    for ($i = 0; $i < $len; $i++) {
        $h ^= ord($str[$i]);
        $h = ($h * 16777619) & 0xFFFFFFFF; // FNV prime, wrap 32 bits (équiv. Math.imul(...) >>> 0)
    }
    return $h % $poolLen;
}

// Mémoïsation par process PHP-FPM (pas un cache inter-requêtes : chaque requête
// HTTP démarre avec $GLOBALS réinitialisé). Aujourd'hui
// `personadle_compute_daily_target()` n'est appelée qu'une fois par requête
// (api/sessions.php), donc ça ne produit aucun hit dans le call-graph actuel —
// ça protège seulement un futur 2ᵉ call-site dans la même requête d'un 2ᵉ
// parsing JSON. Revue PR #13 : les 6 modes sont chargés d'un coup (~40 Ko)
// même si un seul mode est nécessaire par requête — accepté pour l'instant vu
// la taille modeste du fichier, à revisiter si le roster grossit beaucoup.
$GLOBALS['__personadle_daily_pools'] = null;

function personadle_load_daily_pools(): array
{
    if ($GLOBALS['__personadle_daily_pools'] === null) {
        $path = __DIR__ . '/../data/daily_pools.json';
        $json = @file_get_contents($path);
        $GLOBALS['__personadle_daily_pools'] = $json ? (json_decode($json, true) ?? []) : [];
    }
    return $GLOBALS['__personadle_daily_pools'];
}

/**
 * Recalcule la cible quotidienne attendue pour un mode/date/joueur donné.
 *
 * @param string   $mode          Un des 6 modes valides (api/sessions.php::$validModes)
 * @param string   $playedDate    YYYY-MM-DD (heure de Paris)
 * @param string   $seedId        Seed du joueur — `(string) $userId` pour un compte connecté
 *                                 (miroir exact de getPlayerSeedId() côté client : la valeur
 *                                 stockée dans localStorage.playerUserId est `String(user.id)`)
 * @param string[] $activeFilters Codes opus actifs au moment du gain (vide = pas de filtre
 *                                 opus applicable pour ce mode, ou aucun filtre actif)
 * @return string|null Nom attendu, ou null si le pool est introuvable/vide
 */
function personadle_compute_daily_target(string $mode, string $playedDate, string $seedId, array $activeFilters): ?string
{
    $pools = personadle_load_daily_pools();

    switch ($mode) {
        case 'classic':
            return personadle_pick_from_pool($pools['classic']['pool'] ?? [], 'Classic', $playedDate, $seedId);

        case 'emoji':
            return personadle_pick_from_pool($pools['emoji']['pool'] ?? [], 'Emoji', $playedDate, $seedId);

        case 'silhouette':
            return personadle_pick_from_pool($pools['silhouette']['pool'] ?? [], 'Silhouette', $playedDate, $seedId);

        case 'music':
            return personadle_pick_from_pool($pools['music']['pool'] ?? [], 'Music', $playedDate, $seedId);

        case 'alloutattack': {
            $data = $pools['alloutattack'] ?? [];
            $pool = $data['pool'] ?? [];
            $opusByName = $data['opusByName'] ?? [];
            $daily = personadle_pick_from_pool($pool, 'AllOutAttack', $playedDate, $seedId);
            if ($daily === null) return null;
            if (empty($activeFilters)) return $daily;
            $filteredPool = array_values(array_filter($pool, function ($name) use ($opusByName, $activeFilters) {
                $opus = $opusByName[$name] ?? [];
                return count(array_intersect($opus, $activeFilters)) > 0;
            }));
            if (!empty($filteredPool) && !in_array($daily, $filteredPool, true)) {
                return personadle_pick_from_pool($filteredPool, 'AllOutAttack', $playedDate, $seedId);
            }
            return $daily;
        }

        case 'personae': {
            $entries = $pools['personae']['pool'] ?? [];
            $daily = personadle_pick_from_pool($entries, 'Personae', $playedDate, $seedId);
            if ($daily === null) return null;
            if (empty($activeFilters)) return $daily['user'];
            $filteredEntries = array_values(array_filter($entries, function ($entry) use ($activeFilters) {
                return count(array_intersect($entry['opus'] ?? [], $activeFilters)) > 0;
            }));
            // Comparaison sur `persona` (l'entrée exacte tirée), pas `user` : un
            // même personnage peut avoir plusieurs personas dans des opus
            // différents — cf. modePersonae.js::pickCharacter(), `c.persona === daily.persona`.
            $dailyPersona = $daily['persona'];
            $isDailyInFiltered = false;
            foreach ($filteredEntries as $e) {
                if ($e['persona'] === $dailyPersona) { $isDailyInFiltered = true; break; }
            }
            if (!empty($filteredEntries) && !$isDailyInFiltered) {
                $fallback = personadle_pick_from_pool($filteredEntries, 'Personae', $playedDate, $seedId);
                return $fallback['user'] ?? null;
            }
            return $daily['user'];
        }

        default:
            return null;
    }
}

/**
 * @param array<int, mixed> $pool Pool ordonné (strings ou tableaux associatifs)
 * @return mixed|null L'élément choisi, ou null si le pool est vide
 */
function personadle_pick_from_pool(array $pool, string $mode, string $date, string $seedId)
{
    $len = count($pool);
    if ($len === 0) return null;
    $idx = personadle_fnv1a_index($seedId, $date, $mode, $len);
    return $pool[$idx];
}
