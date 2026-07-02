<?php
/**
 * Dhru API Proxy — upload to your cPanel public_html/
 * Provides a static IP for Dhru whitelisting.
 *
 * Setup:
 *  1. Change SECRET below to a long random string.
 *  2. Upload this file to public_html/ on your cPanel domain.
 *  3. In cPanel > Server Information, copy the "Shared IP Address"
 *     and whitelist it in Dhru > Profile > API Access.
 *  4. Tell me the URL (e.g. https://yourdomain.com/dhru-proxy.php)
 *     and the SECRET — I'll add DHRU_PROXY_URL + DHRU_PROXY_KEY.
 */

const SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

header('Content-Type: application/json');

// Auth check
$key = $_SERVER['HTTP_X_PROXY_KEY'] ?? '';
if (!hash_equals(SECRET, $key)) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

// Target URL from header
$target = $_SERVER['HTTP_X_TARGET_URL'] ?? '';
if (!$target || !filter_var($target, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(['error' => 'missing or invalid X-Target-URL header']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body   = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'application/x-www-form-urlencoded'),
    ],
]);

if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
$err      = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream_failed', 'detail' => $err]);
    exit;
}

http_response_code($status);
echo $response;
