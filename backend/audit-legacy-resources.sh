#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-seniorproject101}"
REGION="${REGION:-asia-southeast3}"

LEGACY_LB_FORWARDING_RULE_NAME="${LEGACY_LB_FORWARDING_RULE_NAME:-sci-request-system-https-fr}"
LEGACY_LB_HTTPS_PROXY_NAME="${LEGACY_LB_HTTPS_PROXY_NAME:-sci-request-system-https-proxy}"
LEGACY_LB_URL_MAP_NAME="${LEGACY_LB_URL_MAP_NAME:-sci-request-system-url-map}"
LEGACY_LB_BACKEND_SERVICE_NAME="${LEGACY_LB_BACKEND_SERVICE_NAME:-sci-request-system-backend}"
LEGACY_LB_NEG_NAME="${LEGACY_LB_NEG_NAME:-sci-request-system-neg}"
LEGACY_LB_CERT_NAME="${LEGACY_LB_CERT_NAME:-sci-request-system-managed-cert}"
LEGACY_LB_ADDRESS_NAME="${LEGACY_LB_ADDRESS_NAME:-sci-request-system-ip}"

DOMAIN="${DOMAIN:-api.pstpyst.com}"
LEGACY_LB_IP="${LEGACY_LB_IP:-34.49.113.60}"
SERVICE_NAME="${SERVICE_NAME:-sci-request-system}"

resource_exists() {
  "$@" >/dev/null 2>&1
}

print_status() {
  local label=$1
  local status=$2
  printf '%-28s %s\n' "$label" "$status"
}

echo "--------------------------------------------------"
echo "Legacy Resource Audit"
echo "--------------------------------------------------"
echo "Project ID              : $PROJECT_ID"
echo "Region                  : $REGION"
echo "Service Name            : $SERVICE_NAME"
echo "Domain                  : $DOMAIN"
echo "Legacy LB IP            : $LEGACY_LB_IP"
echo "--------------------------------------------------"

if resource_exists gcloud compute forwarding-rules describe "$LEGACY_LB_FORWARDING_RULE_NAME" --global --project "$PROJECT_ID"; then
  print_status "Forwarding rule" "present ($LEGACY_LB_FORWARDING_RULE_NAME)"
else
  print_status "Forwarding rule" "absent"
fi

if resource_exists gcloud compute target-https-proxies describe "$LEGACY_LB_HTTPS_PROXY_NAME" --global --project "$PROJECT_ID"; then
  print_status "HTTPS proxy" "present ($LEGACY_LB_HTTPS_PROXY_NAME)"
else
  print_status "HTTPS proxy" "absent"
fi

if resource_exists gcloud compute url-maps describe "$LEGACY_LB_URL_MAP_NAME" --global --project "$PROJECT_ID"; then
  print_status "URL map" "present ($LEGACY_LB_URL_MAP_NAME)"
else
  print_status "URL map" "absent"
fi

if resource_exists gcloud compute backend-services describe "$LEGACY_LB_BACKEND_SERVICE_NAME" --global --project "$PROJECT_ID"; then
  print_status "Backend service" "present ($LEGACY_LB_BACKEND_SERVICE_NAME)"
else
  print_status "Backend service" "absent"
fi

if resource_exists gcloud compute network-endpoint-groups describe "$LEGACY_LB_NEG_NAME" --region "$REGION" --project "$PROJECT_ID"; then
  print_status "Serverless NEG" "present ($LEGACY_LB_NEG_NAME)"
else
  print_status "Serverless NEG" "absent"
fi

if resource_exists gcloud compute ssl-certificates describe "$LEGACY_LB_CERT_NAME" --global --project "$PROJECT_ID"; then
  print_status "Managed cert" "present ($LEGACY_LB_CERT_NAME)"
else
  print_status "Managed cert" "absent"
fi

if resource_exists gcloud compute addresses describe "$LEGACY_LB_ADDRESS_NAME" --global --project "$PROJECT_ID"; then
  print_status "Global address" "present ($LEGACY_LB_ADDRESS_NAME)"
else
  print_status "Global address" "absent"
fi

RUN_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)"
if [ -n "$RUN_URL" ]; then
  print_status "Cloud Run URL" "$RUN_URL"
else
  print_status "Cloud Run URL" "unavailable"
fi

DNS_OUTPUT="$(dig +short "$DOMAIN" 2>/dev/null || true)"
if [ -n "$DNS_OUTPUT" ]; then
  print_status "Domain DNS" "$(printf '%s' "$DNS_OUTPUT" | paste -sd ',' -)"
else
  print_status "Domain DNS" "no records returned"
fi

if printf '%s\n' "$DNS_OUTPUT" | grep -qx "$LEGACY_LB_IP"; then
  print_status "Domain points to LB" "yes"
else
  print_status "Domain points to LB" "no"
fi

echo "--------------------------------------------------"
echo "Interpretation"
echo "--------------------------------------------------"
echo "- If Cloud Run URL is the active production entrypoint, legacy LB resources can usually be removed."
echo "- If the domain still points to $LEGACY_LB_IP, do not delete LB resources yet."
