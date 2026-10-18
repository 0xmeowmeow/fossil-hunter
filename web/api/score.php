<?php
// Fossil Hunter leaderboard.
//   GET  score.php?level=ID          -> { top: [...] }
//   POST score.php  {level, seed, name, email, updates, exposure, integrity, minutes}
//                                    -> { id, rank, total, top: [...] }
// The database lives outside the web root. Emails are stored but never returned; only names
// are shown. The score is recomputed here from the submitted numbers.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const LEVELS = ['beecher', 'wheeler', 'calvert', 'cincinnati', 'lyme', 'phacops', 'spiny', 'ghost', 'ridge', 'glossopteris', 'crawfordsville'];

function out($code, $data) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

// docroot/trilobite/api/score.php -> home dir is three levels up from this folder.
$dataDir = dirname(__DIR__, 3) . '/trilobite-data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0700, true)) out(500, ['error' => 'storage unavailable']);

try {
  $db = new PDO('sqlite:' . $dataDir . '/scores.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL, seed INTEGER, name TEXT NOT NULL,
    email TEXT, updates INTEGER NOT NULL DEFAULT 0, exposure REAL NOT NULL, integrity REAL NOT NULL,
    minutes REAL NOT NULL, score INTEGER NOT NULL, created TEXT NOT NULL, iphash TEXT)');
  $db->exec('CREATE INDEX IF NOT EXISTS scores_level ON scores(level, score DESC, minutes ASC)');
} catch (Exception $e) {
  out(500, ['error' => 'storage unavailable']);
}

function top($db, $level) {
  $q = $db->prepare('SELECT id, name, score, minutes, exposure, integrity, created FROM scores
                     WHERE level = ? ORDER BY score DESC, minutes ASC, id ASC LIMIT 20');
  $q->execute([$level]);
  $rows = $q->fetchAll(PDO::FETCH_ASSOC);
  foreach ($rows as &$r) {
    $r['id'] = (int)$r['id'];
    $r['score'] = (int)$r['score'];
    $r['minutes'] = round((float)$r['minutes'], 1);
    $r['exposure'] = round((float)$r['exposure'], 3);
    $r['integrity'] = round((float)$r['integrity'], 3);
  }
  return $rows;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $level = $_GET['level'] ?? '';
  if (!in_array($level, LEVELS, true)) out(400, ['error' => 'unknown level']);
  out(200, ['top' => top($db, $level)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'method not allowed']);

$raw = file_get_contents('php://input', false, null, 0, 4096);
$in = json_decode($raw, true);
if (!is_array($in)) out(400, ['error' => 'bad request']);

$level = $in['level'] ?? '';
if (!in_array($level, LEVELS, true)) out(400, ['error' => 'unknown level']);

// Names: printable, no markup, 1-24 characters.
$name = trim(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($in['name'] ?? '')));
$name = mb_substr($name, 0, 24);
if ($name === '') out(400, ['error' => 'name required']);

$email = trim((string)($in['email'] ?? ''));
if ($email !== '' && (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL))) out(400, ['error' => 'that email address looks wrong']);
$updates = !empty($in['updates']) && $email !== '' ? 1 : 0;

$exposure = (float)($in['exposure'] ?? -1);
$integrity = (float)($in['integrity'] ?? -1);
$minutes = (float)($in['minutes'] ?? -1);
if ($exposure < 0 || $exposure > 1 || $integrity < 0 || $integrity > 1 || $minutes < 0.2 || $minutes > 600) out(400, ['error' => 'implausible result']);
$seed = (int)($in['seed'] ?? 0);
$score = max(0, (int)round(1000 * $exposure * $integrity - 5 * $minutes));

// Gentle rate limit: one entry per 20 s per address (stored only as a salted hash).
$saltFile = $dataDir . '/salt';
if (!is_file($saltFile)) file_put_contents($saltFile, bin2hex(random_bytes(16)));
$iphash = hash('sha256', file_get_contents($saltFile) . ($_SERVER['REMOTE_ADDR'] ?? ''));
$q = $db->prepare("SELECT COUNT(*) FROM scores WHERE iphash = ? AND created > datetime('now', '-20 seconds')");
$q->execute([$iphash]);
if ((int)$q->fetchColumn() > 0) out(429, ['error' => 'slow down a moment and try again']);

$ins = $db->prepare("INSERT INTO scores (level, seed, name, email, updates, exposure, integrity, minutes, score, created, iphash)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)");
$ins->execute([$level, $seed, $name, $email === '' ? null : $email, $updates, $exposure, $integrity, $minutes, $score, $iphash]);
$id = (int)$db->lastInsertId();

$q = $db->prepare('SELECT COUNT(*) FROM scores WHERE level = ? AND (score > ? OR (score = ? AND minutes < ?))');
$q->execute([$level, $score, $score, $minutes]);
$rank = (int)$q->fetchColumn() + 1;
$q = $db->prepare('SELECT COUNT(*) FROM scores WHERE level = ?');
$q->execute([$level]);
$total = (int)$q->fetchColumn();

out(200, ['id' => $id, 'rank' => $rank, 'total' => $total, 'score' => $score, 'top' => top($db, $level)]);
