<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/authz.php';

/**
 * Tests des décisions d'autorisation (api/lib/authz.php) — la porte protégeant
 * requireAuth()/requireAdmin() dans api/bootstrap.php, donc TOUS les endpoints
 * authentifiés et les 8 endpoints api/admin/*. Aucun accès base de données.
 */
final class AuthzTest extends TestCase
{
    // ── personadle_is_admin_row ──────────────────────────────────────────────

    public function testGrantsAdminWhenFlagIsTrue(): void
    {
        $this->assertTrue(personadle_is_admin_row(['is_admin' => 1]));
    }

    public function testDeniesAdminWhenFlagIsFalse(): void
    {
        $this->assertFalse(personadle_is_admin_row(['is_admin' => 0]));
    }

    public function testDeniesAdminWhenRowIsNull(): void
    {
        // Cas : requête SQL n'a rien retourné (compte supprimé entre-temps, id invalide…)
        $this->assertFalse(personadle_is_admin_row(null));
    }

    public function testDeniesAdminWhenFlagIsMissingFromRow(): void
    {
        $this->assertFalse(personadle_is_admin_row(['id' => 1]));
    }

    // ── personadle_session_denial_reason ─────────────────────────────────────

    public function testAllowsAnActiveNonDeletedNonBannedUser(): void
    {
        $this->assertNull(personadle_session_denial_reason(['is_deleted' => 0, 'is_banned' => 0]));
    }

    public function testDeniesWhenRowIsNull(): void
    {
        // Utilisateur introuvable en BDD (compte hard-deleted, id caduc…)
        $this->assertSame('deleted', personadle_session_denial_reason(null));
    }

    public function testDeniesWhenIsDeletedFlagIsSet(): void
    {
        $this->assertSame('deleted', personadle_session_denial_reason(['is_deleted' => 1, 'is_banned' => 0]));
    }

    public function testDeniesWhenIsBannedFlagIsSet(): void
    {
        $this->assertSame('banned', personadle_session_denial_reason(['is_deleted' => 0, 'is_banned' => 1]));
    }

    public function testDeletedTakesPriorityOverBanned(): void
    {
        // Un compte supprimé ET banni doit être traité comme "deleted" (message le plus définitif)
        $this->assertSame('deleted', personadle_session_denial_reason(['is_deleted' => 1, 'is_banned' => 1]));
    }
}
