# Local Docker Compose

From the repository root, run `docker compose pull` and `docker compose up -d --no-build`, then open
http://localhost:8080. Docker with Linux containers is required.
Compose supplies defaults; no `.env` file is required.
The application container uses Docker's init process to reap orphaned agent
subprocesses.

To customize, copy `.env.example` to `.env` in the repository root.
The `.env` file is ignored by Git. Shell environment variables take precedence.
`OMB_HTTP_PORT` changes the host port and the default public URL.
Caddy reaches the server over Unix sockets in the `edge` volume, never its ports.
`RETHOS_IMAGE` selects the published `ghcr.io/hopesy/rethos` image. It includes
Claude Code, Codex CLI and Chromium. Model accounts are configured after deployment.
For a custom image with additional engines, build `deploy/local/Dockerfile` separately.

For Tailscale Serve, set `OMB_PUBLIC_URL` to your HTTPS URL and
`OMB_HTTPS_HOST` to its hostname without scheme or path. Configure Tailscale
Serve on the host to forward to the chosen localhost HTTP port.
Keep the default `OMB_BIND_ADDRESS=127.0.0.1`. Caddy refuses to start when
`OMB_HTTPS_HOST` is set with any other bind address and no
`OMB_TRUSTED_PROXY_CIDRS` list, so direct remote HTTP clients cannot claim
HTTPS semantics by supplying that hostname.
The hostname mapping preserves HTTPS
semantics for that host while localhost access continues to use HTTP.
Private tailnet webhook URLs are only reachable by callers on that tailnet.
Without `OMB_HTTPS_HOST`, the bind address can be changed for HTTP access.
Only use HTTPS hostname mapping with a trusted TLS-terminating proxy.

The TLS terminator does not have to sit on the same host. When the containers
run on one machine and the terminator on another (a Cloudflare Tunnel on
another machine of the same network, for instance), name the terminator in
`OMB_TRUSTED_PROXY_CIDRS` and bind the port where the terminator can reach
it:

```sh
OMB_BIND_ADDRESS=192.168.1.20 OMB_HTTPS_HOST=omb.example.com \
OMB_TRUSTED_PROXY_CIDRS=192.168.1.50/32 docker compose up -d
```

`OMB_TRUSTED_PROXY_CIDRS` lists the addresses of the peers that may claim the
HTTPS hostname, as Caddy sees them. Only those peers are treated as
HTTPS; every other caller on the network stays plain HTTP even when it sends
that hostname. Caddy refuses to start when `OMB_HTTPS_HOST` is set with a
bind address other than `127.0.0.1` and no such list, so a reachable bind
address always names the terminator. Leave the list empty with the default
loopback bind, where the host itself is the only peer.

Sign in and pair:

```sh
docker compose exec rethos codex login --device-auth
docker compose exec rethos rethos pair
```

With the defaults, `pair` prints a sign-in link for a browser on the Docker
host. For the desktop app or a phone on the same network, publish the port
there and name the address they use (only on a machine behind your router):

```sh
OMB_BIND_ADDRESS=0.0.0.0 OMB_PUBLIC_URL=http://192.168.1.20:8080 docker compose up -d
docker compose exec rethos rethos pair    # Link http://192.168.1.20:8080/pair#code=…
```

Paste that link into Rethos under **＋ → Connect to a server**; the app
accepts plain http on a private network address. The other install methods
are in [Self-hosting](../../docs/self-hosting.md#golden-paths).

On Windows, `./maus.ps1` forwards arguments to Compose using the repository
directory. It respects Docker's selected context and `DOCKER_CONTEXT`.

Data and engine credentials persist in the named data volume. For an existing
volume, set `OMB_DATA_VOLUME` to its name and `OMB_DATA_EXTERNAL=true`.
Fresh installs create their volume automatically.

Update with `docker compose pull` followed by `docker compose up -d --no-build --force-recreate`.
Stop with `docker compose stop`. `docker compose down -v` deletes managed volumes.

VPS deployment, HTTPS, backup and rollback: [Rethos VPS guide](../../docs/rethos-vps.md).
