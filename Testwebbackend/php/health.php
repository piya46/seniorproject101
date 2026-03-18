<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$backend = resolve_backend_url();
proxy_json($backend . '/healthz');
