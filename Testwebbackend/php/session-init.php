<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$backend = resolve_backend_url();
$publicKey = fetch_public_key($backend);

try {
    $encryptedPayload = encrypt_secure_payload($publicKey, [
        '_ts' => (int) round(microtime(true) * 1000),
        'nonce' => random_nonce(),
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'error' => 'Failed to prepare encrypted payload',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$result = fetch_remote(
    $backend . '/api/v1/session/init',
    'POST',
    $encryptedPayload,
    ['Content-Type: application/json']
);

$cookieLines = array_values(array_filter(
    $result['headers'],
    static fn (string $line): bool => stripos($line, 'Set-Cookie:') === 0
));

header('Content-Type: application/json; charset=UTF-8');
http_response_code($result['status']);

$decoded = null;
if ($result['body'] !== false) {
    $decoded = json_decode((string) $result['body'], true);
}

echo json_encode([
    'status_code' => $result['status'],
    'set_cookie_headers' => $cookieLines,
    'response' => $decoded ?? $result['body'],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
