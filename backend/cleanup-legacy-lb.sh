#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:?REGION is required}"
LEGACY_LB_FORWARDING_RULE_NAME="${LEGACY_LB_FORWARDING_RULE_NAME:?LEGACY_LB_FORWARDING_RULE_NAME is required}"
LEGACY_LB_HTTPS_PROXY_NAME="${LEGACY_LB_HTTPS_PROXY_NAME:?LEGACY_LB_HTTPS_PROXY_NAME is required}"
LEGACY_LB_URL_MAP_NAME="${LEGACY_LB_URL_MAP_NAME:?LEGACY_LB_URL_MAP_NAME is required}"
LEGACY_LB_BACKEND_SERVICE_NAME="${LEGACY_LB_BACKEND_SERVICE_NAME:?LEGACY_LB_BACKEND_SERVICE_NAME is required}"
LEGACY_LB_NEG_NAME="${LEGACY_LB_NEG_NAME:?LEGACY_LB_NEG_NAME is required}"
LEGACY_LB_CERT_NAME="${LEGACY_LB_CERT_NAME:?LEGACY_LB_CERT_NAME is required}"
LEGACY_LB_ADDRESS_NAME="${LEGACY_LB_ADDRESS_NAME:?LEGACY_LB_ADDRESS_NAME is required}"

delete_if_present() {
  local label="$1"
  shift

  echo "   • $label"
  if "$@" >/tmp/cleanup-legacy-lb.out 2>/tmp/cleanup-legacy-lb.err; then
    cat /tmp/cleanup-legacy-lb.out
    return 0
  fi

  if grep -qi 'was not found\|not found' /tmp/cleanup-legacy-lb.err; then
    echo "     skipped (not found)"
    return 0
  fi

  cat /tmp/cleanup-legacy-lb.err >&2
  return 1
}

echo "--------------------------------------------------"
echo "Cleaning legacy HTTPS load balancer resources"
echo "--------------------------------------------------"
echo "Project ID      : $PROJECT_ID"
echo "Region          : $REGION"
echo "Forwarding Rule : $LEGACY_LB_FORWARDING_RULE_NAME"
echo "HTTPS Proxy     : $LEGACY_LB_HTTPS_PROXY_NAME"
echo "URL Map         : $LEGACY_LB_URL_MAP_NAME"
echo "Backend Service : $LEGACY_LB_BACKEND_SERVICE_NAME"
echo "Serverless NEG  : $LEGACY_LB_NEG_NAME"
echo "Certificate     : $LEGACY_LB_CERT_NAME"
echo "Global Address  : $LEGACY_LB_ADDRESS_NAME"
echo "--------------------------------------------------"

delete_if_present \
  "Deleting forwarding rule" \
  gcloud compute forwarding-rules delete "$LEGACY_LB_FORWARDING_RULE_NAME" --global --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting HTTPS proxy" \
  gcloud compute target-https-proxies delete "$LEGACY_LB_HTTPS_PROXY_NAME" --global --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting URL map" \
  gcloud compute url-maps delete "$LEGACY_LB_URL_MAP_NAME" --global --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting backend service" \
  gcloud compute backend-services delete "$LEGACY_LB_BACKEND_SERVICE_NAME" --global --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting serverless NEG" \
  gcloud compute network-endpoint-groups delete "$LEGACY_LB_NEG_NAME" --region "$REGION" --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting SSL certificate" \
  gcloud compute ssl-certificates delete "$LEGACY_LB_CERT_NAME" --global --project "$PROJECT_ID" -q

delete_if_present \
  "Deleting global address" \
  gcloud compute addresses delete "$LEGACY_LB_ADDRESS_NAME" --global --project "$PROJECT_ID" -q

echo "Legacy load balancer cleanup complete."
