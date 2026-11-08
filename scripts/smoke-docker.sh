#!/usr/bin/env bash
set -Eeuo pipefail
trap 'printf "Smoke failed at line %s: %s\n" "$LINENO" "$BASH_COMMAND" >&2' ERR
mkdir -p .Rethos-temp/docker-smoke
cleanup() {
  docker logs rethos-smoke > .Rethos-temp/docker-smoke/container.log 2>&1 || true
  DOMAIN=localhost RETHOS_IMAGE=rethos:ci COMPOSE_PROJECT_NAME=rethos-release-smoke docker compose -f deploy/docker-compose.yml logs > .Rethos-temp/docker-smoke/compose.log 2>&1 || true
  DOMAIN=localhost RETHOS_IMAGE=rethos:ci COMPOSE_PROJECT_NAME=rethos-release-smoke docker compose -f deploy/docker-compose.yml down -v || true
  docker rm -f rethos-smoke rethos-smoke-probe >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run -d --init --shm-size=512m --name rethos-smoke rethos:ci
for i in $(seq 1 40); do
  if docker exec rethos-smoke curl -sf http://127.0.0.1:8799/api/health | grep -q openmausbot; then break; fi
  sleep 2
  if [ "$i" = "40" ]; then docker logs rethos-smoke; echo "server never became healthy"; exit 1; fi
done
docker exec rethos-smoke curl -sf http://127.0.0.1:8799/ | grep -qi "<html" || { docker logs rethos-smoke; echo "UI not served"; exit 1; }
docker logs rethos-smoke | tail -5

docker exec rethos-smoke test ! -d /app/dist-server/enterprise
docker exec rethos-smoke curl -sf http://127.0.0.1:8799/api/edition | grep -q '"edition":"oss"'
docker exec rethos-smoke curl -sf http://127.0.0.1:8799/api/brand | grep -q '"name":"Rethos"'
docker exec rethos-smoke sh -c 'test -s LICENSE && test -s NOTICE && test -s LICENSING.md && test -d third_party'
docker exec rethos-smoke rethos --help | grep -qi rethos
docker exec rethos-smoke claude --version
docker exec rethos-smoke codex --version
docker exec -w /app/duckdb rethos-smoke node --input-type=module -e "const { DuckDBInstance } = await import('@duckdb/node-api'); const c = await (await DuckDBInstance.create()).connect(); const r = await c.runAndReadAll('select 42 as x'); if (Number(r.getRows()[0][0]) !== 42) process.exit(1)"

test "$(docker exec rethos-smoke id -un)" = maus
timeout 45 docker exec rethos-smoke agent-browser --session ci-browser open 'data:text/html,<title>Rethos browser smoke</title><h1>Browser ready</h1>'
timeout 15 docker exec rethos-smoke agent-browser --session ci-browser get title | grep -Fx 'Rethos browser smoke'
# Chrome for Testing's page is 1280x577 until sized; the harness sizes
# it to 1280x720 so pictures, boxes and clicks agree.
timeout 15 docker exec rethos-smoke agent-browser --session ci-browser set viewport 1280 720
test "$(timeout 15 docker exec rethos-smoke agent-browser --session ci-browser eval "innerWidth+'x'+innerHeight")" = '"1280x720"'
# The harness reads and pictures a bot's browser over the engine's
# loopback relay (server/browser-relay.ts); the daemon writes the file.
port=$(timeout 15 docker exec rethos-smoke agent-browser --session ci-browser stream status --json | jq -r .data.port)
answer=$(docker exec rethos-smoke curl -sf -X POST -H 'content-type: application/json' -H "origin: http://127.0.0.1:$port" \
  --data '{"action":"screenshot","path":"/tmp/relay.jpg","format":"jpeg","quality":70}' "http://127.0.0.1:$port/api/command")
grep -q '"success":true' <<<"$answer"
docker exec rethos-smoke test -s /tmp/relay.jpg
timeout 15 docker exec rethos-smoke agent-browser --session ci-browser close

probe() { docker run --rm --network bridge curlimages/curl:8.14.1 -s --max-time 3 "http://$1:$2/" >/dev/null; }
docker run -d --name rethos-smoke-probe --entrypoint node rethos:ci -e "require('http').createServer((q,s)=>s.end('leak')).listen(8799,'0.0.0.0')"
sleep 2
leaky_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' rethos-smoke-probe)
test -n "$leaky_ip"
probe "$leaky_ip" 8799 || { echo "probe cannot see a 0.0.0.0 listener; the check would be vacuous"; exit 1; }
docker rm -f rethos-smoke-probe >/dev/null
ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' rethos-smoke)
test -n "$ip"
if probe "$ip" 8799 || probe "$ip" 8800; then
  echo "server answered on $ip — it must only bind 127.0.0.1"; exit 1
fi
echo "unreachable on $ip: loopback-only holds"

docker rm -f rethos-smoke >/dev/null
export DOMAIN=localhost RETHOS_IMAGE=rethos:ci COMPOSE_PROJECT_NAME=rethos-release-smoke
export TMPDIR="$PWD/.Rethos-temp/docker-smoke"
mkdir -p "$TMPDIR"
docker compose -f deploy/docker-compose.yml up -d --no-build
for i in $(seq 1 45); do
  curl -sk -o /dev/null --max-time 2 https://localhost/.well-known/openmausbot/environment && break
  sleep 2
  if [ "$i" = "45" ]; then docker compose -f deploy/docker-compose.yml logs; echo "caddy never answered"; exit 1; fi
done
code() { curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "$@"; }
body() { curl -sk --max-time 10 "$@"; }
H=https://localhost
grep -q '"environmentId"' <<<"$(body $H/.well-known/openmausbot/environment)"   # descriptor is public
grep -q '^{"app":"openmausbot"}$' <<<"$(body $H/api/health)"             # the probe is public, and says only the app name
test "$(code $H/api/bots)" = 403                                        # nothing else before pairing
grep -q 'pair this device' <<<"$(body $H/api/bots)"
grep -qi '<html' <<<"$(body $H/pair)"                                    # the UI shell is served so /pair can load
test "$(code http://localhost/)" = 308                                   # HTTP redirects to HTTPS
pairing=$(docker compose -f deploy/docker-compose.yml exec -T rethos rethos pair --label ci)
echo "$pairing"
pcode=$(grep -o 'code=[A-Z2-9-]*' <<<"$pairing" | head -1 | cut -d= -f2)
test -n "$pcode"
jar=$(mktemp)
paired=$(curl -sk --max-time 10 -c "$jar" -D - -X POST $H/api/auth/pair -H 'content-type: application/json' -d "{\"code\":\"$pcode\",\"cookie\":true}")
grep -qi 'set-cookie: omb_session_' <<<"$paired"                        # cookie session
grep -qi 'Secure' <<<"$paired"                                          # over TLS the cookie is Secure
grep -qi 'HttpOnly' <<<"$paired"
test "$(code -b "$jar" $H/api/health)" = 200                              # paired: the API answers
grep -q openmausbot <<<"$(body -b "$jar" $H/api/health)"
test "$(code -b "$jar" -H 'Origin: https://evil.example' -X POST -d '{}' $H/api/bots)" = 403   # cookie is same-origin only
test "$(code -b "$jar" -H 'Origin: https://localhost' $H/api/auth/session)" = 200
grep -q '"via":"cookie"' <<<"$(body -b "$jar" $H/api/auth/session)"
grep -q '"label":"ci"' <<<"$(body -b "$jar" $H/api/auth/sessions)"        # listed for revocation
grep -q error <<<"$(body -X POST $H/hooks/wh_nope)"                      # hook path reaches the receiver without a session
# The event stream never ends, so curl's own --max-time exit (28) is expected;
# the proof is that bytes arrived within the window (a buffering proxy sends none).
sse=$( (curl -sk -b "$jar" -N --max-time 4 $H/api/events || true) | head -c 64 )
test -n "$sse"                                                           # SSE streams, not buffered
grep -q '"baseUrl":"https://localhost"' <<<"$(body -b "$jar" $H/api/webhooks)"   # OMB_WEBHOOK_PUBLIC_URL is advertised
test "$(code $H/api/bots)" = 403                                        # and without the cookie it is still closed
docker compose -f deploy/docker-compose.yml exec -T rethos sh -c 'printf persistent > /data/rethos-release-proof'
docker compose -f deploy/docker-compose.yml up -d --no-build --force-recreate
for i in $(seq 1 45); do
  curl -skf --max-time 2 https://localhost/api/health >/dev/null && break
  sleep 2
done
test "$(docker compose -f deploy/docker-compose.yml exec -T rethos cat /data/rethos-release-proof)" = persistent
test "$(code -b "$jar" $H/api/auth/session)" = 200
docker compose -f deploy/docker-compose.yml down -v
