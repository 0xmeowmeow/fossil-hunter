<?php
// Fossil Hunter's shared world: museums other players can visit, and auctions.
//
// Players are anonymous: each browser makes a random key and sends it as X-FH-Key. Only its
// hash is stored. Specimens travel as baked display meshes (gzipped, a few hundred KB),
// stored once each by content hash.
//
//   GET  world.php?a=museums                 recent published museums
//   GET  world.php?a=museum&id=PUB           one museum (pieces, tour)
//   GET  world.php?a=mesh&h=SHA              a specimen mesh (gzip binary)
//   POST world.php?a=mesh     (binary)       upload a mesh -> { h }
//   POST world.php?a=publish  {name, curator, tour, pieces}
//   GET  world.php?a=auctions                open auctions and recent results
//   GET  world.php?a=auction&id=N            one auction with its bids
//   POST world.php?a=list     {piece, reserve, hours, name}
//   POST world.php?a=bid      {id, amount, name}
//   GET  world.php?a=mine                    my auctions, as seller and bidder
//   POST world.php?a=claim    {id}           take a won piece, or the proceeds, or an unsold piece back
//   POST world.php?a=report   {kind, id}     report a museum or auction (hidden after 3 reports)
//
// Money here is the game's own funds, never real money. The game client keeps its own funds;
// the server only settles who won what for how much.

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out($code, $data) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

$dataDir = getenv('FH_DATA') ?: dirname(__DIR__, 3) . '/trilobite-data';
$dev = getenv('FH_DEV') === '1'; // local testing: allows minute-long auctions
if (!is_dir($dataDir . '/meshes') && !@mkdir($dataDir . '/meshes', 0700, true)) out(500, ['error' => 'storage unavailable']);

try {
  $db = new PDO('sqlite:' . $dataDir . '/world.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA busy_timeout = 4000');
  $db->exec('CREATE TABLE IF NOT EXISTS museums (owner TEXT PRIMARY KEY, pub TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    curator TEXT NOT NULL, tour TEXT, pieces TEXT NOT NULL, updated INTEGER NOT NULL, visits INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0)');
  $db->exec('CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, seller TEXT NOT NULL, seller_name TEXT NOT NULL,
    piece TEXT NOT NULL, reserve INTEGER NOT NULL, started INTEGER NOT NULL, ends INTEGER NOT NULL, price INTEGER NOT NULL DEFAULT 0,
    leader TEXT, leader_name TEXT, nbids INTEGER NOT NULL DEFAULT 0, npc TEXT NOT NULL, ticked INTEGER NOT NULL DEFAULT 0,
    buyer_claimed INTEGER NOT NULL DEFAULT 0, seller_claimed INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0)');
  $db->exec('CREATE TABLE IF NOT EXISTS bids (id INTEGER PRIMARY KEY AUTOINCREMENT, auction INTEGER NOT NULL, bidder TEXT NOT NULL,
    name TEXT NOT NULL, amount INTEGER NOT NULL, at INTEGER NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS bids_auction ON bids(auction, at)');
  $db->exec('CREATE TABLE IF NOT EXISTS reports (kind TEXT NOT NULL, target TEXT NOT NULL, iphash TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (kind, target, iphash))');
  $db->exec('CREATE TABLE IF NOT EXISTS hits (owner TEXT NOT NULL, what TEXT NOT NULL, at INTEGER NOT NULL)');
} catch (Exception $e) {
  out(500, ['error' => 'storage unavailable']);
}

$now = time();
$saltFile = $dataDir . '/salt';
if (!is_file($saltFile)) file_put_contents($saltFile, bin2hex(random_bytes(16)));
$iphash = hash('sha256', file_get_contents($saltFile) . ($_SERVER['REMOTE_ADDR'] ?? ''));

/** The caller's identity (hash of their key), or null. */
function owner() {
  $k = $_SERVER['HTTP_X_FH_KEY'] ?? '';
  return preg_match('/^[a-f0-9]{32,64}$/', $k) ? hash('sha256', 'fh:' . $k) : null;
}
function need_owner() {
  $o = owner();
  if (!$o) out(401, ['error' => 'no player key']);
  return $o;
}
/** At most $n of $what per $secs for this player. */
function limit($db, $owner, $what, $n, $secs) {
  global $now;
  $db->prepare('DELETE FROM hits WHERE at < ?')->execute([$now - 86400]);
  $q = $db->prepare('SELECT COUNT(*) FROM hits WHERE owner = ? AND what = ? AND at > ?');
  $q->execute([$owner, $what, $now - $secs]);
  if ((int)$q->fetchColumn() >= $n) out(429, ['error' => 'slow down a moment and try again']);
  $db->prepare('INSERT INTO hits (owner, what, at) VALUES (?, ?, ?)')->execute([$owner, $what, $now]);
}
function json_in($max = 65536) {
  $in = json_decode(file_get_contents('php://input', false, null, 0, $max), true);
  if (!is_array($in)) out(400, ['error' => 'bad request']);
  return $in;
}

// Player-written text: plain, short, and without the obvious slurs and obscenities.
const BLOCK = ['fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'rape', 'nazi', 'kike', 'spic', 'chink', 'tranny', 'cock', 'pussy', 'dick'];
function clean($s, $max) {
  $s = trim(preg_replace('/[\x00-\x1F\x7F<>]/u', ' ', (string)$s));
  $s = preg_replace('/\s+/u', ' ', $s);
  $s = mb_substr($s, 0, $max);
  $flat = preg_replace('/[^a-z]/', '', strtolower(strtr($s, '013457@$', 'oieastas')));
  foreach (BLOCK as $w) if (strpos($flat, $w) !== false) out(400, ['error' => 'please keep it friendly']);
  return $s;
}
function mesh_ok($h) {
  global $dataDir;
  return is_string($h) && preg_match('/^[a-f0-9]{64}$/', $h) && is_file("$dataDir/meshes/$h.bin");
}
/** A specimen's public record: what a label shows, plus its mesh. */
function piece_in($p) {
  if (!is_array($p) || !mesh_ok($p['mesh'] ?? '')) out(400, ['error' => 'a specimen is missing its model']);
  return [
    'name' => clean($p['name'] ?? '', 60), 'level' => preg_replace('/[^a-z_]/', '', (string)($p['level'] ?? '')),
    'place' => clean($p['place'] ?? '', 80), 'value' => max(0, min(100000, (int)($p['value'] ?? 0))),
    'exposure' => max(0, min(1, (float)($p['exposure'] ?? 0))), 'integrity' => max(0, min(1, (float)($p['integrity'] ?? 0))),
    'mounted' => !empty($p['mounted']), 'repaired' => !empty($p['repaired']), 'mesh' => $p['mesh'],
    'opal' => isset($p['opal']) && is_array($p['opal']) ? array_map('floatval', array_slice($p['opal'], 0, 12)) : null,
  ];
}

// ---- auctions: computer collectors

const NPCS = ['A dealer from Tucson', 'The Natural History Society', 'A private collector in Zürich', 'A university teaching collection',
  'A museum in Osaka', 'A collector in Sheffield', 'A gallery in Santa Fe', 'A retired geologist'];

/**
 * Two to four collectors, each with a ceiling around the piece's value and a few moments
 * during the sale when they look in and bid if they're not already winning.
 */
function npc_plan($value, $start, $ends) {
  $n = random_int(2, 4);
  $names = NPCS;
  shuffle($names);
  $out = [];
  for ($i = 0; $i < $n; $i++) {
    $ceiling = (int)round($value * (0.55 + mt_rand() / mt_getrandmax() * 0.85));
    $times = [];
    $looks = random_int(2, 5);
    for ($k = 0; $k < $looks; $k++) $times[] = $start + (int)(($ends - $start) * (0.05 + 0.93 * mt_rand() / mt_getrandmax()));
    $out[] = ['name' => $names[$i], 'max' => $ceiling, 'times' => $times];
  }
  return $out;
}
function inc($price) {
  return max(5, (int)(ceil($price * 0.05 / 5) * 5));
}
/** Play the collectors' bids up to now, in time order (no scheduler needed). */
function tick($db, &$a) {
  global $now;
  $upto = min($now, (int)$a['ends']);
  if ($upto <= (int)$a['ticked']) return;
  $events = [];
  foreach (json_decode($a['npc'], true) as $i => $n) foreach ($n['times'] as $t) if ($t > (int)$a['ticked'] && $t <= $upto) $events[] = [$t, $i];
  usort($events, fn($x, $y) => $x[0] <=> $y[0]);
  $npcs = json_decode($a['npc'], true);
  foreach ($events as [$t, $i]) {
    // A player's bid placed after this moment hasn't happened yet from the collector's view,
    // but bids are only ever placed "now", after a tick, so order holds.
    $me = "npc:$i";
    if ($a['leader'] === $me) continue;
    $next = (int)$a['nbids'] ? (int)$a['price'] + inc((int)$a['price']) : (int)$a['reserve'];
    if ($next > $npcs[$i]['max']) continue;
    $a['price'] = $next;
    $a['leader'] = $me;
    $a['leader_name'] = $npcs[$i]['name'];
    $a['nbids'] = (int)$a['nbids'] + 1;
    $db->prepare('INSERT INTO bids (auction, bidder, name, amount, at) VALUES (?, ?, ?, ?, ?)')->execute([$a['id'], $me, $npcs[$i]['name'], $next, $t]);
  }
  $a['ticked'] = $upto;
  $db->prepare('UPDATE auctions SET price = ?, leader = ?, leader_name = ?, nbids = ?, ticked = ? WHERE id = ?')
     ->execute([$a['price'], $a['leader'], $a['leader_name'], $a['nbids'], $a['ticked'], $a['id']]);
}
function auction_out($a, $me) {
  global $now;
  $open = $now < (int)$a['ends'];
  $sold = !$open && (int)$a['nbids'] > 0;
  return [
    'id' => (int)$a['id'], 'piece' => json_decode($a['piece'], true), 'seller' => $a['seller_name'], 'mine' => $me && $a['seller'] === $me,
    'reserve' => (int)$a['reserve'], 'price' => (int)$a['price'], 'next' => (int)$a['nbids'] ? (int)$a['price'] + inc((int)$a['price']) : (int)$a['reserve'],
    'bids' => (int)$a['nbids'], 'leader' => $a['leader_name'], 'leading' => $me && $a['leader'] === $me,
    'ends' => (int)$a['ends'], 'left' => max(0, (int)$a['ends'] - $now), 'status' => $open ? 'open' : ($sold ? 'sold' : 'unsold'),
    'buyerClaimed' => (bool)$a['buyer_claimed'], 'sellerClaimed' => (bool)$a['seller_claimed'],
  ];
}
function load_auction($db, $id) {
  $q = $db->prepare('SELECT * FROM auctions WHERE id = ?');
  $q->execute([(int)$id]);
  $a = $q->fetch(PDO::FETCH_ASSOC);
  if (!$a) out(404, ['error' => 'no such auction']);
  return $a;
}

$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($a === 'mesh' && $method === 'GET') {
  $h = $_GET['h'] ?? '';
  if (!mesh_ok($h)) out(404, ['error' => 'not found']);
  header('Content-Type: application/octet-stream');
  header('Cache-Control: public, max-age=31536000, immutable');
  readfile("$dataDir/meshes/$h.bin");
  exit;
}

if ($a === 'mesh' && $method === 'POST') {
  $o = need_owner();
  limit($db, $o, 'mesh', 60, 3600);
  $body = file_get_contents('php://input', false, null, 0, 1600001);
  if (strlen($body) > 1600000) out(413, ['error' => 'that specimen is too big to share']);
  if (strlen($body) < 64 || substr($body, 0, 2) !== "\x1f\x8b") out(400, ['error' => 'bad model']);
  $h = hash('sha256', $body);
  if (!is_file("$dataDir/meshes/$h.bin")) file_put_contents("$dataDir/meshes/$h.bin", $body);
  out(200, ['h' => $h]);
}

if ($a === 'museums') {
  $rows = $db->query('SELECT pub, name, curator, pieces, tour, updated, visits FROM museums WHERE hidden = 0 ORDER BY updated DESC LIMIT 60')->fetchAll(PDO::FETCH_ASSOC);
  $me = owner();
  $mine = null;
  if ($me) {
    $q = $db->prepare('SELECT pub FROM museums WHERE owner = ?');
    $q->execute([$me]);
    $mine = $q->fetchColumn() ?: null;
  }
  out(200, ['mine' => $mine, 'museums' => array_map(fn($r) => ['id' => $r['pub'], 'name' => $r['name'], 'curator' => $r['curator'],
    'pieces' => count(json_decode($r['pieces'], true)), 'tour' => (bool)$r['tour'], 'updated' => (int)$r['updated'], 'visits' => (int)$r['visits']], $rows)]);
}

if ($a === 'museum') {
  $q = $db->prepare('SELECT * FROM museums WHERE pub = ? AND hidden = 0');
  $q->execute([(string)($_GET['id'] ?? '')]);
  $m = $q->fetch(PDO::FETCH_ASSOC);
  if (!$m) out(404, ['error' => 'no such museum']);
  if (owner() !== $m['owner']) $db->prepare('UPDATE museums SET visits = visits + 1 WHERE pub = ?')->execute([$m['pub']]);
  out(200, ['id' => $m['pub'], 'name' => $m['name'], 'curator' => $m['curator'], 'pieces' => json_decode($m['pieces'], true),
    'tour' => $m['tour'] ? json_decode($m['tour'], true) : null, 'updated' => (int)$m['updated'], 'visits' => (int)$m['visits']]);
}

if ($a === 'publish' && $method === 'POST') {
  $o = need_owner();
  limit($db, $o, 'publish', 20, 3600);
  $in = json_in(200000);
  $name = clean($in['name'] ?? '', 60);
  $curator = clean($in['curator'] ?? '', 40);
  if ($name === '' || $curator === '') out(400, ['error' => 'give your museum and yourself a name']);
  $pieces = array_map('piece_in', array_slice((array)($in['pieces'] ?? []), 0, 12));
  if (!$pieces) out(400, ['error' => 'put something on display first']);
  $tour = null;
  if (!empty($in['tour']['stops'])) {
    $tour = ['name' => clean($in['tour']['name'] ?? '', 60), 'stops' => []];
    foreach (array_slice($in['tour']['stops'], 0, 8) as $s) {
      $slot = (int)($s['slot'] ?? -1);
      if ($slot >= 0 && $slot < count($pieces)) $tour['stops'][] = ['slot' => $slot, 'card' => clean($s['card'] ?? '', 400)];
    }
  }
  $q = $db->prepare('SELECT pub FROM museums WHERE owner = ?');
  $q->execute([$o]);
  $pub = $q->fetchColumn() ?: substr(bin2hex(random_bytes(8)), 0, 10);
  $db->prepare('INSERT INTO museums (owner, pub, name, curator, tour, pieces, updated) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner) DO UPDATE SET name = excluded.name, curator = excluded.curator, tour = excluded.tour, pieces = excluded.pieces, updated = excluded.updated')
     ->execute([$o, $pub, $name, $curator, $tour ? json_encode($tour, JSON_UNESCAPED_UNICODE) : null, json_encode($pieces, JSON_UNESCAPED_UNICODE), $now]);
  out(200, ['id' => $pub]);
}

if ($a === 'auctions') {
  $me = owner();
  $rows = $db->query('SELECT * FROM auctions WHERE hidden = 0 AND ends > ' . ($now - 2 * 86400) . ' ORDER BY ends ASC LIMIT 80')->fetchAll(PDO::FETCH_ASSOC);
  $list = [];
  foreach ($rows as $r) {
    tick($db, $r);
    $list[] = auction_out($r, $me);
  }
  out(200, ['auctions' => $list, 'now' => $now]);
}

if ($a === 'auction') {
  $r = load_auction($db, $_GET['id'] ?? 0);
  tick($db, $r);
  $q = $db->prepare('SELECT name, amount, at FROM bids WHERE auction = ? ORDER BY at DESC, id DESC LIMIT 30');
  $q->execute([$r['id']]);
  out(200, ['auction' => auction_out($r, owner()), 'bids' => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($a === 'list' && $method === 'POST') {
  $o = need_owner();
  limit($db, $o, 'list', 10, 3600);
  $in = json_in(20000);
  $piece = piece_in($in['piece'] ?? null);
  $hours = (float)($in['hours'] ?? 24);
  $allowed = $dev ? [0.05, 1, 6, 24, 48] : [1, 6, 24, 48];
  if (!in_array($hours, $allowed, false)) out(400, ['error' => 'pick a length for the sale']);
  $reserve = max(5, min(100000, (int)($in['reserve'] ?? 0)));
  $name = clean($in['name'] ?? '', 40) ?: 'A preparator';
  $ends = $now + (int)round($hours * 3600);
  $db->prepare('INSERT INTO auctions (seller, seller_name, piece, reserve, started, ends, npc, ticked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
     ->execute([$o, $name, json_encode($piece, JSON_UNESCAPED_UNICODE), $reserve, $now, $ends, json_encode(npc_plan($piece['value'], $now, $ends)), $now]);
  out(200, ['id' => (int)$db->lastInsertId(), 'ends' => $ends]);
}

if ($a === 'bid' && $method === 'POST') {
  $o = need_owner();
  limit($db, $o, 'bid', 60, 3600);
  $in = json_in(2000);
  $db->beginTransaction();
  $r = load_auction($db, $in['id'] ?? 0);
  tick($db, $r);
  if ($now >= (int)$r['ends']) { $db->commit(); out(400, ['error' => 'the hammer has already come down']); }
  if ($r['seller'] === $o) { $db->commit(); out(400, ['error' => "you can't bid on your own piece"]); }
  if ($r['leader'] === $o) { $db->commit(); out(400, ['error' => "you're already the highest bidder"]); }
  $next = (int)$r['nbids'] ? (int)$r['price'] + inc((int)$r['price']) : (int)$r['reserve'];
  $amount = (int)($in['amount'] ?? 0);
  if ($amount < $next) { $db->commit(); out(400, ['error' => "the next bid is at least \$$next"]); }
  $name = clean($in['name'] ?? '', 40) ?: 'A preparator';
  $db->prepare('INSERT INTO bids (auction, bidder, name, amount, at) VALUES (?, ?, ?, ?, ?)')->execute([$r['id'], $o, $name, $amount, $now]);
  // A bid in the last two minutes holds the hammer back a little, so nobody snipes.
  $ends = max((int)$r['ends'], $now + 120);
  $db->prepare('UPDATE auctions SET price = ?, leader = ?, leader_name = ?, nbids = nbids + 1, ends = ? WHERE id = ?')
     ->execute([$amount, $o, $name, $ends, $r['id']]);
  $db->commit();
  $r = load_auction($db, $r['id']);
  out(200, ['auction' => auction_out($r, $o)]);
}

if ($a === 'mine') {
  $o = need_owner();
  $q = $db->prepare('SELECT * FROM auctions WHERE seller = ? OR id IN (SELECT auction FROM bids WHERE bidder = ?) ORDER BY ends DESC LIMIT 60');
  $q->execute([$o, $o]);
  $list = [];
  foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
    tick($db, $r);
    $x = auction_out($r, $o);
    $x['bidOn'] = $r['seller'] !== $o;
    $list[] = $x;
  }
  out(200, ['auctions' => $list]);
}

if ($a === 'claim' && $method === 'POST') {
  $o = need_owner();
  $in = json_in(2000);
  $db->beginTransaction();
  $r = load_auction($db, $in['id'] ?? 0);
  tick($db, $r);
  if ($now < (int)$r['ends']) { $db->commit(); out(400, ['error' => 'still going']); }
  $sold = (int)$r['nbids'] > 0;
  if ($sold && $r['leader'] === $o && !(int)$r['buyer_claimed']) {
    $db->prepare('UPDATE auctions SET buyer_claimed = 1 WHERE id = ?')->execute([$r['id']]);
    $db->commit();
    out(200, ['won' => json_decode($r['piece'], true), 'price' => (int)$r['price'], 'from' => $r['seller_name']]);
  }
  if ($r['seller'] === $o && !(int)$r['seller_claimed']) {
    $db->prepare('UPDATE auctions SET seller_claimed = 1 WHERE id = ?')->execute([$r['id']]);
    $db->commit();
    out(200, $sold ? ['proceeds' => (int)$r['price'], 'to' => $r['leader_name']] : ['unsold' => true]);
  }
  $db->commit();
  out(400, ['error' => 'nothing to claim']);
}

if ($a === 'report' && $method === 'POST') {
  $in = json_in(1000);
  $kind = ($in['kind'] ?? '') === 'auction' ? 'auction' : 'museum';
  $id = substr(preg_replace('/[^a-z0-9]/', '', (string)($in['id'] ?? '')), 0, 20);
  $db->prepare('INSERT OR IGNORE INTO reports (kind, target, iphash, at) VALUES (?, ?, ?, ?)')->execute([$kind, $id, $iphash, $now]);
  $q = $db->prepare('SELECT COUNT(*) FROM reports WHERE kind = ? AND target = ?');
  $q->execute([$kind, $id]);
  if ((int)$q->fetchColumn() >= 3) {
    if ($kind === 'museum') $db->prepare('UPDATE museums SET hidden = 1 WHERE pub = ?')->execute([$id]);
    else $db->prepare('UPDATE auctions SET hidden = 1 WHERE id = ?')->execute([(int)$id]);
  }
  out(200, ['ok' => true]);
}

out(400, ['error' => 'unknown request']);
