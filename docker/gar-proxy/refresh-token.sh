#!/usr/bin/env bash
set -euo pipefail

auth_dir="${GAR_AUTH_DIR:-$HOME/.local/state/gar-proxy}"
container="${GAR_PROXY_CONTAINER:-gar-proxy}"

gcloud_args=(auth print-access-token --verbosity=error)
if [[ -n "${GAR_SERVICE_ACCOUNT:-}" ]]; then
  gcloud_args+=("--impersonate-service-account=$GAR_SERVICE_ACCOUNT")
fi

umask 077
mkdir -p "$auth_dir"
token="$(gcloud "${gcloud_args[@]}")"
printf 'proxy_set_header Authorization "Bearer %s";\n' "$token" >"$auth_dir/token.conf.tmp"
mv "$auth_dir/token.conf.tmp" "$auth_dir/token.conf"

if ! docker kill --signal=HUP "$container" >/dev/null 2>&1; then
  echo "gar-proxy: $container is not running; it loads the token on start" >&2
fi
