#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
REGION="${REGION:-asia-southeast3}"
SERVICE_NAME="${SERVICE_NAME:-ai-formcheck-frontend}"
SOURCE_DIR="${SOURCE_DIR:-${SCRIPT_DIR}}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-ai-formcheck-backend}"
BACKEND_URL="${BACKEND_URL:-}"
GA_MEASUREMENT_ID="${GA_MEASUREMENT_ID:-G-9GNJXM5BHF}"
SA_NAME="${SA_NAME:-ai-formcheck-frontend-sa}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
TRUSTED_BFF_SHARED_SECRET_SECRET="${TRUSTED_BFF_SHARED_SECRET_SECRET:-TRUSTED_BFF_SHARED_SECRET}"
TRUSTED_BFF_AUTH_HEADER_NAME="${TRUSTED_BFF_AUTH_HEADER_NAME:-x-bff-auth}"
SKIP_ENABLE_APIS="${SKIP_ENABLE_APIS:-false}"
SKIP_RUN_INVOKER_BINDING="${SKIP_RUN_INVOKER_BINDING:-false}"
SKIP_SECRET_ACCESS_BINDING="${SKIP_SECRET_ACCESS_BINDING:-false}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

trim_value() {
  local value=$1
  printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

require_command() {
  local name=$1
  if ! command -v "$name" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: $name is not installed.${NC}"
    exit 1
  fi
}

require_gcloud_auth() {
  local active_account
  active_account=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)

  if [ -z "$active_account" ]; then
    echo -e "${RED}❌ No active gcloud account found.${NC}"
    echo -e "${YELLOW}ℹ️  Run: gcloud auth login${NC}"
    exit 1
  fi

  if ! gcloud auth print-access-token >/dev/null 2>&1; then
    echo -e "${RED}❌ Active gcloud account is present but access token could not be obtained.${NC}"
    echo -e "${YELLOW}ℹ️  Active account: ${active_account}${NC}"
    echo -e "${YELLOW}ℹ️  Re-run: gcloud auth login${NC}"
    exit 1
  fi

  echo -e "🔐 Active gcloud account: ${YELLOW}${active_account}${NC}"
}

validate_required_value() {
  local label=$1
  local value=$2
  if [ -z "$value" ]; then
    echo -e "${RED}❌ Missing required value: ${label}${NC}"
    exit 1
  fi
}

validate_boolean() {
  local label=$1
  local value=$2
  case "$value" in
    true|false) ;;
    *)
      echo -e "${RED}❌ ${label} must be 'true' or 'false', got '${value}'.${NC}"
      exit 1
      ;;
  esac
}

derive_canonical_run_app_base_url() {
  local service_name_value=$1
  local project_number_value=$2
  printf 'https://%s-%s.%s.run.app' "$service_name_value" "$project_number_value" "$REGION"
}

BACKEND_URL="$(trim_value "$BACKEND_URL")"
GA_MEASUREMENT_ID="$(trim_value "$GA_MEASUREMENT_ID")"
TRUSTED_BFF_AUTH_HEADER_NAME="$(trim_value "$TRUSTED_BFF_AUTH_HEADER_NAME")"
TRUSTED_BFF_SHARED_SECRET_SECRET="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_SECRET")"
SKIP_ENABLE_APIS="$(trim_value "$SKIP_ENABLE_APIS")"
SKIP_RUN_INVOKER_BINDING="$(trim_value "$SKIP_RUN_INVOKER_BINDING")"
SKIP_SECRET_ACCESS_BINDING="$(trim_value "$SKIP_SECRET_ACCESS_BINDING")"

validate_required_value "PROJECT_ID" "$PROJECT_ID"
validate_required_value "REGION" "$REGION"
validate_required_value "SERVICE_NAME" "$SERVICE_NAME"
validate_required_value "BACKEND_SERVICE_NAME" "$BACKEND_SERVICE_NAME"
validate_required_value "SA_NAME" "$SA_NAME"
validate_required_value "TRUSTED_BFF_SHARED_SECRET_SECRET" "$TRUSTED_BFF_SHARED_SECRET_SECRET"
validate_required_value "TRUSTED_BFF_AUTH_HEADER_NAME" "$TRUSTED_BFF_AUTH_HEADER_NAME"
validate_boolean "SKIP_ENABLE_APIS" "$SKIP_ENABLE_APIS"
validate_boolean "SKIP_RUN_INVOKER_BINDING" "$SKIP_RUN_INVOKER_BINDING"
validate_boolean "SKIP_SECRET_ACCESS_BINDING" "$SKIP_SECRET_ACCESS_BINDING"

if [ "$SERVICE_NAME" = "$BACKEND_SERVICE_NAME" ]; then
  echo -e "${RED}❌ SERVICE_NAME and BACKEND_SERVICE_NAME must not be the same.${NC}"
  exit 1
fi

echo -e "${GREEN}--------------------------------------------------${NC}"
echo -e "${GREEN}🚀 Starting FRONTEND BFF deploy for ${SERVICE_NAME}...${NC}"
echo -e "📍 Region: ${YELLOW}${REGION}${NC}"
echo -e "🔗 Backend URL: ${YELLOW}${BACKEND_URL}${NC}"
echo -e "📊 GA Measurement ID: ${YELLOW}${GA_MEASUREMENT_ID:-<not-set>}${NC}"
echo -e "${GREEN}--------------------------------------------------${NC}"

require_command gcloud
require_command sed
require_gcloud_auth

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
echo -e "🔎 Current Project: ${YELLOW}${CURRENT_PROJECT}${NC}"

if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo -e "${YELLOW}⚠️  Switching project to ${PROJECT_ID}...${NC}"
  gcloud config set project "${PROJECT_ID}" >/dev/null
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
if [ -z "$BACKEND_URL" ]; then
  BACKEND_URL="$(derive_canonical_run_app_base_url "$BACKEND_SERVICE_NAME" "$PROJECT_NUMBER")"
fi

validate_required_value "BACKEND_URL" "$BACKEND_URL"
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *)
    echo -e "${RED}❌ BACKEND_URL must start with http:// or https://, got '${BACKEND_URL}'.${NC}"
    exit 1
    ;;
esac

if [ "$SKIP_ENABLE_APIS" = "true" ]; then
  echo -e "   ℹ️  Skipping API enable step because SKIP_ENABLE_APIS=true"
else
  echo -e "${YELLOW}🛠️  Enabling required APIs...${NC}"
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    iam.googleapis.com \
    iamcredentials.googleapis.com
fi

echo -e "${YELLOW}🔐 Checking frontend runtime service account...${NC}"
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo -e "   🔐 Creating runtime service account: ${SA_NAME}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --description="Minimal privilege SA for Frontend Cloud Run" \
    --display-name="Frontend Cloud Run SA" \
    --project "${PROJECT_ID}" >/dev/null

  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/logging.logWriter" >/dev/null

  sleep 5
else
  echo -e "   ✅ Runtime service account exists: ${SA_EMAIL}"
fi

echo -e "${YELLOW}🔑 Checking trusted BFF secret...${NC}"
if ! gcloud secrets describe "${TRUSTED_BFF_SHARED_SECRET_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo -e "${RED}❌ Trusted BFF secret ${TRUSTED_BFF_SHARED_SECRET_SECRET} was not found.${NC}"
  echo -e "${YELLOW}ℹ️  Deploy the backend private BFF flow first, or create the secret before deploying frontend.${NC}"
  exit 1
fi

if [ "$SKIP_SECRET_ACCESS_BINDING" = "true" ]; then
  echo -e "   ℹ️  Skipping Secret Manager IAM binding because SKIP_SECRET_ACCESS_BINDING=true"
else
  echo -e "   🔐 Granting Secret Manager accessor on ${TRUSTED_BFF_SHARED_SECRET_SECRET} to ${SA_EMAIL}..."
  gcloud secrets add-iam-policy-binding "${TRUSTED_BFF_SHARED_SECRET_SECRET}" \
    --project "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
fi

if [ "$SKIP_RUN_INVOKER_BINDING" = "true" ]; then
  echo -e "   ℹ️  Skipping Cloud Run Invoker binding because SKIP_RUN_INVOKER_BINDING=true"
else
  echo -e "   🔐 Granting Cloud Run Invoker on ${BACKEND_SERVICE_NAME} to ${SA_EMAIL}..."
  gcloud run services add-iam-policy-binding "${BACKEND_SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.invoker" >/dev/null
fi

echo -e "${YELLOW}📦 Deploying frontend BFF from ${SOURCE_DIR}...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
  --source "${SOURCE_DIR}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${SA_EMAIL}" \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars "BACKEND_URL=${BACKEND_URL},TRUSTED_BFF_AUTH_HEADER_NAME=${TRUSTED_BFF_AUTH_HEADER_NAME},GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}" \
  --set-secrets "TRUSTED_BFF_SHARED_SECRET=${TRUSTED_BFF_SHARED_SECRET_SECRET}:latest"

echo -e "${GREEN}✅ Frontend BFF deploy completed for ${SERVICE_NAME}.${NC}"