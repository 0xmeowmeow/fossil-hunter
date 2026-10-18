<?php
// Fossil Hunter updates list.
//   POST subscribe.php  {email, name?}  -> { ok: true }
// Stored outside the web root, never shown anywhere. One row per address (re-subscribing just
// refreshes it).
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out($code, $data) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'method not allowed']);

$dataDir = dirname(__DIR__, 3) . '/trilobite-data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0700, true)) out(500, ['error' => 'storage unavailable']);

$in = json_decode(file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($in)) out(400, ['error' => 'bad request']);
$email = trim((string)($in['email'] ?? ''));
if ($email === '' || strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) out(400, ['error' => 'that email address looks wrong']);
$name = mb_substr(trim(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($in['name'] ?? ''))), 0, 40);
$source = mb_substr(preg_replace('/[^a-z0-9_-]/i', '', (string)($in['source'] ?? '')), 0, 24);

try {
  $db = new PDO('sqlite:' . $dataDir . '/subscribers.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY COLLATE NOCASE, name TEXT,
    source TEXT, created TEXT NOT NULL, updated TEXT NOT NULL, iphash TEXT)');
  $saltFile = $dataDir . '/salt';
  if (!is_file($saltFile)) file_put_contents($saltFile, bin2hex(random_bytes(16)));
  $iphash = hash('sha256', file_get_contents($saltFile) . ($_SERVER['REMOTE_ADDR'] ?? ''));
  // Gentle rate limit: a handful of sign-ups per address per hour.
  $q = $db->prepare("SELECT COUNT(*) FROM subscribers WHERE iphash = ? AND updated > datetime('now', '-1 hour')");
  $q->execute([$iphash]);
  if ((int)$q->fetchColumn() >= 5) out(429, ['error' => 'slow down a moment and try again']);
  $db->prepare("INSERT INTO subscribers (email, name, source, created, updated, iphash) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
                ON CONFLICT(email) DO UPDATE SET name = COALESCE(NULLIF(excluded.name, ''), name), updated = excluded.updated")
     ->execute([$email, $name, $source, $iphash]);
} catch (Exception $e) {
  out(500, ['error' => 'storage unavailable']);
}
out(200, ['ok' => true]);
