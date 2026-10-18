#!/bin/sh
# The real PHP API (api/world.php) for local testing, in a container on :8001. serve.py
# forwards /api/world.php to it. Data goes in .devdata/world/. FH_DEV=1 allows minute-long auctions.
#   tools/php.sh          start (or restart)
#   tools/php.sh stop
cd "$(dirname "$0")/.." || exit 1
docker rm -f fh-php >/dev/null 2>&1
[ "$1" = stop ] && exit 0
mkdir -p .devdata/world
exec docker run -d --name fh-php -e FH_DATA=/data -e FH_DEV=1 --user "$(id -u):$(id -g)" \
  -v "$PWD/api:/app/api:ro" -v "$PWD/.devdata/world:/data" -p 127.0.0.1:8001:8000 \
  php:8.2-cli php -S 0.0.0.0:8000 -t /app
