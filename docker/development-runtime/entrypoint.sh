#!/bin/sh
set -eu
if [ "${NB_MODE:-}" = development_verify ]; then
  exec python -I /opt/axtn/verify.py
fi
exec /usr/local/bin/entrypoint.sh "$@"
