#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
BUCKET_NAME="sci-request-files-prod"
SECRET_NAME="JWT_SECRET"
FRONTEND_URL="*"

# ✅ 1. App Region: รันที่สิงคโปร์เหมือนเดิม (User ไทยเข้าไว)
REGION="asia-southeast1"

# ✅ 2. AI Region: ชี้ไปที่ US (เพื่อใช้ Gemini 2.0 Flash)
AI_LOCATION="us-central1"

echo "--------------------------------------------------"
echo "🚀 Starting deployment for $SERVICE_NAME..."
echo "📍 App Region: $REGION (Singapore)"
echo "🧠 AI Region: $AI_LOCATION (US)"
echo "--------------------------------------------------"

if ! command -v gcloud &> /dev/null
then
    echo "❌ Error: gcloud CLI is not installed."
    exit 1
fi

echo "🚀 Deploying to Cloud Run..."

# ส่งตัวแปร GCP_LOCATION ไปให้โค้ดรู้ว่าต้องยิง AI ที่ไหน
if gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID="$PROJECT_ID" \
  --set-env-vars GCS_BUCKET_NAME="$BUCKET_NAME" \
  --set-env-vars GCP_LOCATION="$AI_LOCATION" \
  --set-env-vars FRONTEND_URL="$FRONTEND_URL" \
  --set-secrets JWT_SECRET="$SECRET_NAME:latest"; then
  
  echo "--------------------------------------------------"
  echo "✅ Deployment Successful!"
else
  echo "--------------------------------------------------"
  echo "❌ Deployment Failed! Please check the logs above."
  exit 1
fi