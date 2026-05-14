<?php
// Stub pour POST /api/friends (sans slash final).
// Permet à l'ancienne version de api.js (cachée dans le SW) d'atteindre
// le bon handler sans passer par la redirection 301→GET de mod_dir.
require_once __DIR__ . '/friends/index.php';
