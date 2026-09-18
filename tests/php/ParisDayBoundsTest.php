<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/social_link.php';

/**
 * Frontière de journée Paris côté SQL — le piège `CONVERT_TZ`.
 *
 * ── Ce qui s'est passé ───────────────────────────────────────────────────────
 * Les requêtes « interactions d'aujourd'hui » du Social Link filtraient avec
 * `DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = :jour`. Vers un fuseau
 * NOMMÉ, `CONVERT_TZ` a besoin des tables de fuseaux du serveur SQL
 * (`mysql.time_zone_name`) — pas peuplées par défaut, et typiquement absentes d'un
 * hébergement mutualisé. Le dépôt le savait déjà : `api/admin/activity.php` le
 * documente en toutes lettres et contourne en regroupant côté PHP. Les quatre
 * requêtes du Social Link, elles, étaient restées sur CONVERT_TZ.
 *
 * Sans ces tables, `CONVERT_TZ` ne lève rien : il renvoie NULL, `DATE(NULL) = '…'`
 * vaut NULL, donc faux, et la requête ne trouve JAMAIS rien. Mesuré sur une
 * MariaDB 10.11 sans tables de fuseaux :
 *   - garde anti-spam morte → 180 `share_streak` d'affilée le même jour acceptés,
 *     2700 XP, rang 10 atteint d'un coup ;
 *   - donc le wallpaper `dark_shopping_district` (rang ≥ 5) ET le titre
 *     `aigis_metis_same_soul` (rang ≥ 10) accordés par simple répétition ;
 *   - bonus mutuel mort → deux amis actifs le même jour payés au tarif solo.
 *
 * ── Pourquoi aucun test ne l'avait vu ────────────────────────────────────────
 * L'image Docker MySQL de la CI EMBARQUE les tables de fuseaux. Les tests
 * passaient donc au vert sur un chemin que la prod n'emprunte pas — le cas exact
 * décrit par CLAUDE.md §13 : « CI verte insuffisante si elle ne peut pas exécuter
 * le scénario concerné ». Les deux tests de DatabaseIntegrationTest qui couvrent
 * la garde et le bonus mutuel sont bons ; c'est l'environnement qui mentait.
 *
 * Ce fichier attaque donc sous deux angles, aucun ne dépendant du serveur SQL :
 *   1. un garde-fou STATIQUE — plus aucun CONVERT_TZ exécuté dans api/ ;
 *   2. la correction du calcul de bornes, DST compris.
 */
final class ParisDayBoundsTest extends TestCase
{
    // ── 1. Garde-fou statique ────────────────────────────────────────────────

    public function testNoExecutedConvertTzRemainsInApi(): void
    {
        $offenders = [];

        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(__DIR__ . '/../../api', FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            if ($file->getExtension() !== 'php') continue;

            // Sur le CODE seul : les fichiers concernés EXPLIQUENT en commentaire
            // pourquoi CONVERT_TZ a été retiré, et une recherche brute retomberait
            // sur ces explications.
            $code = self::stripComments(file_get_contents($file->getPathname()));
            if (stripos($code, 'CONVERT_TZ') !== false) {
                $offenders[] = str_replace(dirname(__DIR__, 2) . '/', '', $file->getPathname());
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "CONVERT_TZ vers un fuseau nommé renvoie NULL là où les tables de fuseaux du "
            . "serveur SQL ne sont pas peuplées (hébergement mutualisé) : la condition ne "
            . "matche alors jamais, en silence. Utiliser personadle_paris_day_bounds_utc(). "
            . "Fichiers en cause : " . implode(', ', $offenders)
        );
    }

    /** Retire commentaires de bloc et de ligne d'une source PHP. */
    private static function stripComments(string $php): string
    {
        $out = '';
        foreach (token_get_all($php) as $tok) {
            if (is_array($tok) && in_array($tok[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
            $out .= is_array($tok) ? $tok[1] : $tok;
        }
        return $out;
    }

    // ── 2. Le calcul de bornes lui-même ──────────────────────────────────────

    public function testBoundsSpanExactlyOneDayInWinter(): void
    {
        // Hiver : Paris = UTC+1. La journée du 15 janvier commence à 23:00 UTC la veille.
        [$start, $end] = personadle_paris_day_bounds_utc('2026-01-15');

        $this->assertSame('2026-01-14 23:00:00', $start);
        $this->assertSame('2026-01-15 23:00:00', $end);
    }

    public function testBoundsSpanExactlyOneDayInSummer(): void
    {
        // Été : Paris = UTC+2. La journée du 15 juillet commence à 22:00 UTC la veille.
        [$start, $end] = personadle_paris_day_bounds_utc('2026-07-15');

        $this->assertSame('2026-07-14 22:00:00', $start);
        $this->assertSame('2026-07-15 22:00:00', $end);
    }

    public function testSpringForwardDayLastsOnlyTwentyThreeHours(): void
    {
        // 29 mars 2026 : passage à l'heure d'été (2h → 3h). Cette journée dure 23 h.
        // C'est ce que `modify('+1 day')` sur un objet en heure de Paris sait faire
        // et qu'un « +86400 secondes » raterait.
        [$start, $end] = personadle_paris_day_bounds_utc('2026-03-29');

        $hours = intdiv(strtotime($end . ' UTC') - strtotime($start . ' UTC'), 3600);
        $this->assertSame(23, $hours, 'la journée de passage à l\'heure d\'été dure 23 h');
    }

    public function testFallBackDayLastsTwentyFiveHours(): void
    {
        // 25 octobre 2026 : retour à l'heure d'hiver (3h → 2h). Cette journée dure 25 h.
        [$start, $end] = personadle_paris_day_bounds_utc('2026-10-25');

        $hours = intdiv(strtotime($end . ' UTC') - strtotime($start . ' UTC'), 3600);
        $this->assertSame(25, $hours, 'la journée de retour à l\'heure d\'hiver dure 25 h');
    }

    public function testBoundsAreContiguousAcrossConsecutiveDays(): void
    {
        // La fin d'une journée est exactement le début de la suivante : aucune
        // interaction ne peut tomber dans un trou, ni être comptée deux fois.
        foreach (['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25', '2026-06-30'] as $day) {
            [, $end]      = personadle_paris_day_bounds_utc($day);
            [$nextStart,] = personadle_paris_day_bounds_utc(
                (new DateTime($day))->modify('+1 day')->format('Y-m-d')
            );
            $this->assertSame($end, $nextStart, "discontinuité après $day");
        }
    }

    public function testDefaultsToTodayInParis(): void
    {
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        $this->assertSame(
            personadle_paris_day_bounds_utc($today),
            personadle_paris_day_bounds_utc(),
            'sans argument, la fonction doit viser la journée Paris en cours'
        );
    }

    public function testNowAlwaysFallsInsideTodaysBounds(): void
    {
        // L'invariant qui compte pour l'appelant : `created_at` d'une interaction
        // écrite maintenant (NOW() en UTC) doit tomber dans la fenêtre du jour.
        [$start, $end] = personadle_paris_day_bounds_utc();
        $nowUtc = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

        $this->assertGreaterThanOrEqual($start, $nowUtc);
        $this->assertLessThan($end, $nowUtc);
    }
}
