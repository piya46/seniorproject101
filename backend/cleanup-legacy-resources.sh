#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DELETE_LEGACY_LB="${DELETE_LEGACY_LB:-false}"

if [ "$DELETE_LEGACY_LB" != "true" ]; then
  echo "Legacy cleanup is disabled."
  echo "Run with DELETE_LEGACY_LB=true to remove legacy LB resources."
  exit 0
fi

"$SCRIPT_DIR/cleanup-legacy-lb.sh"
