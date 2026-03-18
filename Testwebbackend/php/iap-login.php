<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$backend = resolve_backend_url();

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1:8088';
$returnTo = $scheme . '://' . $host . '/index.php?iap=done';
$target = $backend . '/api/v1/iap/complete?return_to=' . rawurlencode($returnTo);

header('Cache-Control: no-store');
header('Location: ' . $target, true, 302);
exit;
