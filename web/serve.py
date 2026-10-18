#!/usr/bin/env python3
"""Serve the game. Plain HTTP on localhost is enough for desktop.

WebXR on a Quest (or anything else on the LAN) needs HTTPS:
    ./serve.py --https          # makes a self-signed cert in .cert/ on first run
then open https://<this-machine-ip>:8443 on the headset and accept the certificate warning.
"""
import argparse, http.server, os, socket, ssl, subprocess, functools

ap = argparse.ArgumentParser()
ap.add_argument("--https", action="store_true")
ap.add_argument("--port", type=int)
a = ap.parse_args()
root = os.path.dirname(os.path.abspath(__file__))
port = a.port or (8443 if a.https else 8000)


import json, sqlite3, urllib.parse

LEVELS = {"beecher", "wheeler", "calvert", "cincinnati", "lyme", "phacops", "spiny", "ghost", "ridge"}
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".devdata", "scores.sqlite")


def db():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    c = sqlite3.connect(DB)
    c.execute("""CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, seed INTEGER,
                 name TEXT, email TEXT, updates INTEGER, exposure REAL, integrity REAL, minutes REAL, score INTEGER, created TEXT)""")
    return c


def top(c, level):
    rows = c.execute("SELECT id, name, score, minutes, exposure, integrity, created FROM scores WHERE level=? "
                     "ORDER BY score DESC, minutes ASC, id ASC LIMIT 20", (level,)).fetchall()
    return [dict(id=r[0], name=r[1], score=r[2], minutes=round(r[3], 1), exposure=r[4], integrity=r[5], created=r[6]) for r in rows]


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files, plus a stand-in for api/score.php (the real one is PHP on the host)."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _php(self):
        """Forward to the real PHP (tools/php.sh runs it in a container on :8001)."""
        import urllib.request, urllib.error
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        sub = self.path[self.path.index("/api/"):]
        req = urllib.request.Request("http://127.0.0.1:8001" + sub, data=body, method=self.command)
        for h in ("Content-Type", "X-FH-Key"):
            if self.headers.get(h):
                req.add_header(h, self.headers[h])
        try:
            r = urllib.request.urlopen(req, timeout=30)
            code, data, ctype = r.status, r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            code, data, ctype = e.code, e.read(), e.headers.get("Content-Type", "")
        except OSError:
            return self._json(503, {"error": "PHP isn't running: tools/php.sh"})
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path.endswith("/api/world.php"):
            return self._php()
        if u.path.endswith("/api/score.php"):
            level = urllib.parse.parse_qs(u.query).get("level", [""])[0]
            if level not in LEVELS:
                return self._json(400, {"error": "unknown level"})
            return self._json(200, {"top": top(db(), level)})
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path.endswith("/api/world.php"):
            return self._php()
        if urllib.parse.urlparse(self.path).path.endswith("/api/subscribe.php"):
            n = int(self.headers.get("Content-Length") or 0)
            d = json.loads(self.rfile.read(min(n, 2048)) or b"{}")
            if "@" not in str(d.get("email", "")):
                return self._json(400, {"error": "that email address looks wrong"})
            with open(os.path.join(os.path.dirname(DB), "subscribers.jsonl"), "a") as fh:
                fh.write(json.dumps({"email": d.get("email"), "name": d.get("name", ""), "source": d.get("source", "")}) + "\n")
            return self._json(200, {"ok": True})
        if urllib.parse.urlparse(self.path).path.endswith("/api/event.php"):
            n = min(int(self.headers.get("Content-Length", 0)), 65536)
            os.makedirs(os.path.dirname(DB), exist_ok=True)
            with open(os.path.join(os.path.dirname(DB), "events.jsonl"), "ab") as fh:
                fh.write(self.rfile.read(n) + b"\n")
            return self._json(200, {"ok": True})
        if not urllib.parse.urlparse(self.path).path.endswith("/api/score.php"):
            return self._json(404, {"error": "not found"})
        n = min(int(self.headers.get("Content-Length", 0)), 4096)
        try:
            d = json.loads(self.rfile.read(n))
        except ValueError:
            return self._json(400, {"error": "bad request"})
        level, name = d.get("level"), str(d.get("name", "")).strip()[:24]
        if level not in LEVELS or not name:
            return self._json(400, {"error": "bad request"})
        e, i, m = float(d.get("exposure", -1)), float(d.get("integrity", -1)), float(d.get("minutes", -1))
        if not (0 <= e <= 1 and 0 <= i <= 1 and 0.2 <= m <= 600):
            return self._json(400, {"error": "implausible result"})
        score = max(0, round(1000 * e * i - 5 * m))
        c = db()
        cur = c.execute("INSERT INTO scores (level, seed, name, email, updates, exposure, integrity, minutes, score, created) "
                        "VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))",
                        (level, int(d.get("seed", 0)), name, d.get("email") or None, int(bool(d.get("updates"))), e, i, m, score))
        c.commit()
        rank = c.execute("SELECT COUNT(*) FROM scores WHERE level=? AND (score>? OR (score=? AND minutes<?))", (level, score, score, m)).fetchone()[0] + 1
        total = c.execute("SELECT COUNT(*) FROM scores WHERE level=?", (level,)).fetchone()[0]
        return self._json(200, {"id": cur.lastrowid, "rank": rank, "total": total, "score": score, "top": top(c, level)})


handler = functools.partial(Handler, directory=root)
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
if a.https:
    cert = os.path.join(root, ".cert")
    os.makedirs(cert, exist_ok=True)
    crt, key = os.path.join(cert, "cert.pem"), os.path.join(cert, "key.pem")
    if not os.path.exists(crt):
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825",
                        "-keyout", key, "-out", crt, "-subj", "/CN=fossil-hunter-dev"], check=True)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(crt, key)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
try:
    ip = socket.gethostbyname(socket.gethostname())
except OSError:
    ip = "localhost"
print(f"Fossil Hunter on {'https' if a.https else 'http'}://localhost:{port}  (LAN: {ip}:{port})")
httpd.serve_forever()
