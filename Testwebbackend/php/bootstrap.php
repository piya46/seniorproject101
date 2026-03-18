<?php
declare(strict_types=1);

function resolve_backend_url(): string
{
    $backend = $_GET['backend'] ?? getenv('TESTWEBBACKEND_BASE_URL') ?: 'https://api.pstpyst.com';
    $backend = trim((string) $backend);
    $backend = rtrim($backend, '/');

    if ($backend === '' || !preg_match('/^https?:\/\//i', $backend)) {
        http_response_code(400);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'error' => 'Invalid backend URL'
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $backend;
}

function proxy_json(string $url): void
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: Testwebbackend-PHP\r\n",
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $status = 502;

    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $status = (int) $matches[1];
    }

    header('Content-Type: application/json; charset=UTF-8');
    http_response_code($status);

    if ($body === false) {
        echo json_encode([
            'error' => 'Request failed',
            'url' => $url,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return;
    }

    echo $body;
}

function fetch_remote(string $url, string $method = 'GET', ?string $body = null, array $headers = []): array
{
    $headerLines = [
        'Accept: application/json',
        'User-Agent: Testwebbackend-PHP',
    ];

    foreach ($headers as $header) {
        $headerLines[] = $header;
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'timeout' => 20,
            'ignore_errors' => true,
            'header' => implode("\r\n", $headerLines) . "\r\n",
            'content' => $body ?? '',
        ],
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $status = 502;

    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $status = (int) $matches[1];
    }

    return [
        'status' => $status,
        'body' => $responseBody,
        'headers' => $http_response_header ?? [],
    ];
}

function random_nonce(): string
{
    return bin2hex(random_bytes(16));
}

function fetch_public_key(string $backend): string
{
    $result = fetch_remote($backend . '/api/v1/auth/public-key');

    if ($result['body'] === false || $result['status'] < 200 || $result['status'] >= 300) {
        http_response_code(502);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'error' => 'Unable to fetch public key',
            'status' => $result['status'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = json_decode((string) $result['body'], true);
    $publicKey = $data['publicKey'] ?? null;

    if (!is_string($publicKey) || trim($publicKey) === '') {
        http_response_code(502);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'error' => 'Public key missing in response',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $publicKey;
}

function encrypt_secure_payload(string $publicKeyPem, array $payload): string
{
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($json === false) {
        throw new RuntimeException('Failed to encode payload');
    }

    $aesKey = random_bytes(32);
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($json, 'aes-256-gcm', $aesKey, OPENSSL_RAW_DATA, $iv, $tag);

    if ($ciphertext === false) {
        throw new RuntimeException('AES encryption failed');
    }

    $ok = openssl_public_encrypt($aesKey, $encryptedKey, $publicKeyPem, OPENSSL_PKCS1_OAEP_PADDING);

    if (!$ok) {
        throw new RuntimeException('RSA encryption failed');
    }

    return json_encode([
        'encKey' => base64_encode($encryptedKey),
        'payload' => base64_encode($ciphertext),
        'iv' => base64_encode($iv),
        'tag' => base64_encode($tag),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
