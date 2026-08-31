#!/usr/bin/env sh
set -eu

source_dir=/home/alex/aXtn-agentswarms/deploy/axtn

install -m 0644 \
  "$source_dir/caddy.extension-access.v1.caddy" \
  /etc/caddy/conf.d/00-axtn-extension-access-v1.caddy
rm -f /etc/caddy/conf.d/axtn-extension-access-v1.caddy
install -m 0644 \
  "$source_dir/caddy.git.extension-access.caddy" \
  /etc/caddy/conf.d/axtn-git.caddy
install -m 0644 \
  "$source_dir/caddy.n8n.extension-access.caddy" \
  /etc/caddy/conf.d/agentswarms-n8n-extension.caddy
install -m 0644 \
  "$source_dir/caddy.matrix-admin.extension-access.caddy" \
  /etc/caddy/conf.d/agentswarms-matrix-admin-extension.caddy

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
