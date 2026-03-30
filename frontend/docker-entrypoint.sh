#!/bin/sh
set -eu

: "${BACKEND_URL:=https://sci-request-system-466086429766.asia-southeast3.run.app}"

envsubst '${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /tmp/default.conf

exec "$@"
