<?php
// Anonymous gameplay telemetry: batches of events from the game, used to tune difficulty,
// pacing and rewards. No names, emails or IP addresses are stored; the install id is a random
// token the browser makes for itself.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{}'; exit; }
$raw = file_get_contents('php://input', false, null, 0, 65536);
$in = json_decode($raw, true);
if (!is_array($in) || !isset($in['events']) || !is_array($in['events'])) { http_response_code(400); echo '{}'; exit; }
$install = substr(preg_replace('/[^a-z0-9]/i', '', (string)($in['install'] ?? '')), 0, 32);
$session = substr(preg_replace('/[^a-z0-9]/i', '', (string)($in['session'] ?? '')), 0, 32);
if ($install === '' || $session === '') { http_response_code(400); echo '{}'; exit; }
$dataDir = dirname(__DIR__, 3) . '/trilobite-data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0700, true);
try {
  $db = new PDO('sqlite:' . $dataDir . '/events.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, install TEXT, session TEXT,
             t REAL, type TEXT, level TEXT, data TEXT, received TEXT)');
  $db->exec('CREATE INDEX IF NOT EXISTS events_type ON events(type, level)');
  $ins = $db->prepare("INSERT INTO events (install, session, t, type, level, data, received) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))");
  $db->beginTransaction();
  foreach (array_slice($in['events'], 0, 200) as $e) {
    if (!is_array($e)) continue;
    $type = substr(preg_replace('/[^a-z0-9_]/i', '', (string)($e['type'] ?? '')), 0, 32);
    if ($type === '') continue;
    $level = substr(preg_replace('/[^a-z0-9_]/i', '', (string)($e['level'] ?? '')), 0, 32);
    $data = json_encode($e['data'] ?? null);
    if (strlen($data) > 4000) $data = substr($data, 0, 4000);
    $ins->execute([$install, $session, (float)($e['t'] ?? 0), $type, $level, $data]);
  }
  $db->commit();
} catch (Exception $x) { http_response_code(500); echo '{}'; exit; }
echo '{"ok":true}';
