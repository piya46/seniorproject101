#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
REGION="${REGION:-asia-southeast3}"
SERVICE_NAME="${SERVICE_NAME:-ai-formcheck-frontend}"
SOURCE_DIR="${SOURCE_DIR:-${SCRIPT_DIR}}"
BACKEND_URL="${BACKEND_URL:-https://sci-request-system-466086429766.asia-southeast3.run.app}"
SA_NAME="${SA_NAME:-sa-frontend-run}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

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
  --set-env-vars "BACKEND_URL=${BACKEND_URL}"
