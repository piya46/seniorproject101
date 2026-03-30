#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
REGION="${REGION:-asia-southeast3}"
SERVICE_NAME="${SERVICE_NAME:-ai-formcheck-frontend}"
SOURCE_DIR="${SOURCE_DIR:-${SCRIPT_DIR}}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-ai-formcheck-backend}"
BACKEND_URL="${BACKEND_URL:-https://ai-formcheck-backend-499335698145.asia-southeast3.run.app}"
SA_NAME="${SA_NAME:-ai-formcheck-frontend-sa}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
TRUSTED_BFF_SHARED_SECRET_SECRET="${TRUSTED_BFF_SHARED_SECRET_SECRET:-TRUSTED_BFF_SHARED_SECRET}"
TRUSTED_BFF_AUTH_HEADER_NAME="${TRUSTED_BFF_AUTH_HEADER_NAME:-x-bff-auth}"

echo "Deploying ${SERVICE_NAME} to project ${PROJECT_ID} in ${REGION}"
gcloud config set project "${PROJECT_ID}"

echo "Checking runtime service account..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --description="Minimal privilege SA for Frontend Cloud Run" \
    --display-name="Frontend Cloud Run SA" \
    --project "${PROJECT_ID}"

  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/logging.logWriter" >/dev/null

  sleep 5
fi

if gcloud secrets describe "${TRUSTED_BFF_SHARED_SECRET_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Granting Secret Manager accessor on ${TRUSTED_BFF_SHARED_SECRET_SECRET} to ${SA_EMAIL}..."
  gcloud secrets add-iam-policy-binding "${TRUSTED_BFF_SHARED_SECRET_SECRET}" \
    --project "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
else
  echo "Trusted BFF secret ${TRUSTED_BFF_SHARED_SECRET_SECRET} was not found. Frontend BFF deploy will continue, but proxy auth will fail until the secret exists."
fi

echo "Granting Cloud Run Invoker on ${BACKEND_SERVICE_NAME} to ${SA_EMAIL}..."
gcloud run services add-iam-policy-binding "${BACKEND_SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" >/dev/null

echo "Deploying frontend from ${SOURCE_DIR}..."
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
  --set-env-vars "BACKEND_URL=${BACKEND_URL},TRUSTED_BFF_AUTH_HEADER_NAME=${TRUSTED_BFF_AUTH_HEADER_NAME}" \
  --set-secrets "TRUSTED_BFF_SHARED_SECRET=${TRUSTED_BFF_SHARED_SECRET_SECRET}:latest"
