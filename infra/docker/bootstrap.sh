#!/usr/bin/env sh
set -eu

ROLE="${PORTARIUM_CONTAINER_ROLE:-${PORTARIUM_ROLE:-control-plane}}"
PORT="${PORTARIUM_HTTP_PORT:-${PORTARIUM_PORT:-8080}}"
BOOT_PID=""

echo "Portarium ${ROLE} scaffold started on port ${PORT}."
echo "A production entrypoint should replace this script in a release cycle."

cleanup() {
  if [ -n "$BOOT_PID" ]; then
    echo "Shutting down Portarium ${ROLE} scaffold process."
    kill "$BOOT_PID" 2>/dev/null || true
    wait "$BOOT_PID" 2>/dev/null || true
  fi
  exit 0
}

trap cleanup INT TERM

if command -v node >/dev/null 2>&1; then
  node - <<'NODE' &
const http = require('http');

const role = process.env.PORTARIUM_CONTAINER_ROLE || process.env.PORTARIUM_ROLE || 'control-plane';
const port = Number(process.env.PORTARIUM_HTTP_PORT || process.env.PORTARIUM_PORT || '8080');
const startedAt = new Date().toISOString();

function renderHealth() {
  return JSON.stringify({
    service: role,
    status: 'ok',
    startedAt
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/readyz' || req.url === '/ready') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(renderHealth());
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain');
  res.end(`Portarium ${role} infra scaffold`);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Portarium ${role} scaffold listening on ${port}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
NODE
  BOOT_PID=$!
else
  echo "Node runtime unavailable; running as a no-op process."
fi

# Keep process alive to represent a deployable service boundary during infra validation.
while true; do
  sleep 3600
done
