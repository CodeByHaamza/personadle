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
 * Repli filtré (les SIX modes, depuis la 2.2) : la cible est tirée du catalogue
 * complet, mais si les filtres d'opus du joueur l'excluent, on re-tire avec la
 * même graine DANS le pool filtré — personadle_pick_within_filters(), miroir
 * exact de getDailyTargetWithin() (js/gameCore.js). Sans ça la partie du jour
 * était injouable pour un joueur qui filtre (AOA et Personae le faisaient déjà
 * depuis la 2.1, les quatre autres modes non — l'aide des filtres promettait
 * pourtant « seuls les jeux gardés peuvent tomber »).
 *
 * ⚠️ LIMITATION CONNUE (revue PR #13, étendue aux six modes en 2.2) —
 * `$activeFilters` est accepté tel que soumis par le client, sans être corrélé
 * à un état connu côté serveur (aucune session ne mémorise le filtre opus
 * réellement actif). Un client peut donc soumettre n'importe quel sous-ensemble
 * des codes opus pour faire correspondre le recalcul serveur au nom qu'il veut
 * faire valider. Sans conséquence tant que la phase 1 (détection, voir
 * api/sessions.php) reste en mode logging seul. À résoudre AVANT tout rejet
 * strict, pour les six modes d'un coup : filtres synchronisés sur le compte
 * (comme `profiles.settings`) et recalcul depuis les filtres STOCKÉS,
 * `active_filters` soumis ne servant plus que de signal de cohérence — voir
 * ROADMAP.md § Sécurité/compte.
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
        // Quatre modes à pool de NOMS : la cible est tirée du catalogue complet puis,
        // si les filtres du joueur l'excluent, re-tirée dans le pool filtré — voir
        // personadle_pick_within_filters(). Les variantes Expert qui gardent le
        // roster du mode normal (émoji, silhouette, AOA) réutilisent son pool ET sa
        // table d'opus avec une clé de hash distincte, pour que le tirage soit
        // indépendant : jouer le mode normal d'abord — indice plus généreux —
        // donnerait la réponse de l'Expert du jour.
        case 'classic':
            return personadle_pick_within_filters($pools['classic'] ?? [], 'Classic', $playedDate, $seedId, $activeFilters);
        case 'emoji':
            return personadle_pick_within_filters($pools['emoji'] ?? [], 'Emoji', $playedDate, $seedId, $activeFilters);
        case 'silhouette':
            return personadle_pick_within_filters($pools['silhouette'] ?? [], 'Silhouette', $playedDate, $seedId, $activeFilters);
        case 'music':
            return personadle_pick_within_filters($pools['music'] ?? [], 'Music', $playedDate, $seedId, $activeFilters);
        // Mode Music Expert — pool ET clé de hash distincts de 'music' (chansons à
        // paroles seulement). Le client passe la même chaîne "MusicExpert" à
        // getDailyTargetWithin() — les deux doivent rester identiques, sinon chaque
        // partie Expert est loguée en anti_cheat. Table d'opus : celle de `music`
        // (mêmes titres).
        case 'music_expert':
            return personadle_pick_within_filters(
                ['pool' => $pools['music_expert']['pool'] ?? [], 'opusByName' => $pools['music']['opusByName'] ?? []],
                'MusicExpert', $playedDate, $seedId, $activeFilters
            );
        // Classique Expert : seule la citation est donnée, donc seuls les personnages
        // qui en ont une sont tirables — pool propre, plus étroit que `classic`,
        // table d'opus de `classic` (mêmes noms).
        case 'classic_expert':
            return personadle_pick_within_filters(
                ['pool' => $pools['classic_expert']['pool'] ?? [], 'opusByName' => $pools['classic']['opusByName'] ?? []],
                'ClassicExpert', $playedDate, $seedId, $activeFilters
            );
        // Émoji Expert : même roster que le mode normal — l'indice change (un des
        // émojis affichés est un leurre), pas le pool.
        case 'emoji_expert':
            return personadle_pick_within_filters($pools['emoji'] ?? [], 'EmojiExpert', $playedDate, $seedId, $activeFilters);
        // Silhouette Expert : MÊME roster que le mode normal — seul l'indice change
        // (dézoom figé au maximum).
        case 'silhouette_expert':
            return personadle_pick_within_filters($pools['silhouette'] ?? [], 'SilhouetteExpert', $playedDate, $seedId, $activeFilters);
        // AOA Expert : même roster et même logique de filtre que le mode normal
        // (l'indice change — flou figé et noir et blanc — pas le pool).
        case 'alloutattack_expert':
            return personadle_pick_within_filters($pools['alloutattack'] ?? [], 'AllOutAttackExpert', $playedDate, $seedId, $activeFilters);
        case 'alloutattack':
            return personadle_pick_within_filters($pools['alloutattack'] ?? [], 'AllOutAttack', $playedDate, $seedId, $activeFilters);

        // Personae Expert : pool restreint aux personas ayant une fiche de lore
        // (139 entrées sur 153) et clé de hash distincte. Même corps que le cas
        // normal ci-dessous : la logique de filtre opus est identique.
        case 'personae_expert':
        case 'personae': {
            $estExpert = $mode === 'personae_expert';
            $entries = $pools[$estExpert ? 'personae_expert' : 'personae']['pool'] ?? [];
            $hashKey = $estExpert ? 'PersonaeExpert' : 'Personae';
            $daily = personadle_pick_from_pool($entries, $hashKey, $playedDate, $seedId);
            if ($daily === null) return null;
            if (empty($activeFilters)) return $daily['user'];
            // Appartenance au pool filtré par INDEX dans le pool, pas par nom de
            // persona : trois personas sont homonymes (Hermes, Susano-o,
            // Prometheus — deux personnages, deux opus, deux dessins). Comparer le
            // nom faisait passer le Prometheus de Futaba (P5R) pour « présent » chez
            // un joueur « P2 uniquement », parce que celui de Baofu (P2EP) l'était :
            // pas de re-tirage, partie du jour injouable. Miroir de l'identité de
            // référence côté client (getDailyTargetWithin, keyOf par défaut).
            $filteredKeyed = array_filter($entries, function ($entry) use ($activeFilters) {
                return count(array_intersect($entry['opus'] ?? [], $activeFilters)) > 0;
            });
            $dailyIdx = personadle_fnv1a_index($seedId, $playedDate, $hashKey, count($entries));
            if (!empty($filteredKeyed) && !array_key_exists($dailyIdx, $filteredKeyed)) {
                $fallback = personadle_pick_from_pool(array_values($filteredKeyed), $hashKey, $playedDate, $seedId);
                return $fallback['user'] ?? null;
            }
            return $daily['user'];
        }

        default:
            return null;
    }
}

/**
 * Cible du jour d'un pool de NOMS, dans les filtres d'opus du joueur — miroir
 * exact de getDailyTargetWithin() (js/gameCore.js) : tirage sur le pool complet,
 * puis, si la cible n'appartient à aucun opus actif, re-tirage avec la même
 * graine dans le pool filtré (`array_filter` conserve l'ordre du fichier source,
 * comme `pool.filter()` côté client). Aucun filtre, ou un filtre qui vide le
 * pool → cible du catalogue complet, comme le client.
 *
 * @param array{pool?: list<string>, opusByName?: array<string, list<string>>} $data
 * @param list<string> $activeFilters
 */
function personadle_pick_within_filters(array $data, string $hashKey, string $date, string $seedId, array $activeFilters): ?string
{
    $pool = $data['pool'] ?? [];
    $daily = personadle_pick_from_pool($pool, $hashKey, $date, $seedId);
    if ($daily === null || empty($activeFilters)) return $daily;
    $opusByName = $data['opusByName'] ?? [];
    $filteredPool = array_values(array_filter($pool, function ($name) use ($opusByName, $activeFilters) {
        $opus = $opusByName[$name] ?? [];
        return count(array_intersect($opus, $activeFilters)) > 0;
    }));
    if (!empty($filteredPool) && !in_array($daily, $filteredPool, true)) {
        return personadle_pick_from_pool($filteredPool, $hashKey, $date, $seedId);
    }
    return $daily;
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
