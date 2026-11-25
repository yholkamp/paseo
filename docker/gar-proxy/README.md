# gar-proxy

A read-only nginx proxy in front of a Google Artifact Registry Maven repository.
Builds inside the Paseo container pull from `http://gar-proxy:8080/` without
holding Google credentials. The host mints a short-lived access token with
`gcloud` every 20 minutes and nginx adds it to each upstream request.

Run everything in this guide on the host that runs the Paseo container, not
inside the container.

## Requirements

- Docker with Compose v2
- `gcloud`, logged in as an account that can read the repository, or that can
  impersonate a service account that can (`roles/iam.serviceAccountTokenCreator`)
- systemd user units for the token timer

## Install

1. From the repo root, copy this directory to `~/.config/gar-proxy`:

   ```bash
   cp -r docker/gar-proxy ~/.config/gar-proxy
   cd ~/.config/gar-proxy
   cp .env.example .env
   ```

2. Find the Docker network of the Paseo container:

   ```bash
   docker inspect <paseo-container> -f '{{json .NetworkSettings.Networks}}'
   ```

   If it only lists `bridge`, create a network and attach Paseo to it. Container
   names don't resolve on the default bridge.

   ```bash
   docker network create paseo
   docker network connect paseo <paseo-container>
   ```

3. Fill in `.env`:

   | Variable              | Value                                                           |
   | --------------------- | --------------------------------------------------------------- |
   | `GAR_UPSTREAM`        | `https://<LOCATION>-maven.pkg.dev/<PROJECT>/<REPOSITORY>/`      |
   | `PASEO_NETWORK`       | The network from step 2                                         |
   | `GAR_SERVICE_ACCOUNT` | Service account to impersonate; leave empty for the gcloud user |
   | `GAR_AUTH_DIR`        | Token directory; defaults to `~/.local/state/gar-proxy`         |

   Keep values unquoted. The systemd unit reads the same file.

4. Mint the first token and start the proxy:

   ```bash
   set -a; . ./.env; set +a
   ./refresh-token.sh
   docker compose up -d
   ```

5. Install the timer that keeps the token fresh. Tokens expire after an hour.

   ```bash
   mkdir -p ~/.config/systemd/user
   cp systemd/gar-proxy-token.* ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now gar-proxy-token.timer
   loginctl enable-linger "$USER"
   ```

   Linger keeps the timer running while you're logged out. If `gcloud` isn't in
   `~/google-cloud-sdk/bin`, `/snap/bin`, or `/usr/local/bin`, edit `PATH` in
   `gar-proxy-token.service`.

6. Point Maven inside the Paseo container at the proxy. Copy
   `maven-settings.example.xml` to `~/.m2/settings.xml` in the container's home
   (`/home/paseo`), and set `<mirrorOf>` to the `<id>` of the Artifact Registry
   repository in your project's `pom.xml`. Don't use `*`: that also routes Maven
   Central through the proxy.

## Check it works

From inside the Paseo container:

```bash
curl -sI http://gar-proxy:8080/<group-path>/<artifact>/maven-metadata.xml
```

`200` means the proxy and token work. `401` or `403` means the token is missing,
expired, or lacks read access: run `systemctl --user start gar-proxy-token` on
the host and check `journalctl --user -u gar-proxy-token`. A DNS error means the
two containers aren't on the same network.

## Security

The proxy has no authentication of its own. Any container on `PASEO_NETWORK` can
read the repository. It allows `GET` and `HEAD` only, and publishes no host
port. Keep it that way.
