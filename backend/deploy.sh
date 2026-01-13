#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
BUCKET_NAME="sci-request-files-prod"
SECRET_NAME="JWT_SECRET"
FRONTEND_URL="*"

# ✅ 1. App Region (Cloud Run): รันที่สิงคโปร์เพื่อให้ใกล้ไทย
REGION="asia-southeast1"

# ✅ 2. AI Region (Vertex AI): ใช้ us-central1 เป็น Gateway เข้าถึง Gemini 3 Global
AI_LOCATION="us-central1"

echo "--------------------------------------------------"
echo "🚀 Starting deployment for $SERVICE_NAME..."
echo "📍 App Region: $REGION"
echo "🧠 AI Region: $AI_LOCATION (Gemini 3 Gateway)"
echo "--------------------------------------------------"

# ตรวจสอบ gcloud
if ! command -v gcloud &> /dev/null
then
    echo "❌ Error: gcloud CLI is not installed."
    exit 1
fi

# รันคำสั่ง Deploy
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID="$PROJECT_ID" \
  --set-env-vars GCS_BUCKET_NAME="$BUCKET_NAME" \
  --set-env-vars GCP_LOCATION="$AI_LOCATION" \
  --set-env-vars FRONTEND_URL="$FRONTEND_URL" \
  --set-secrets JWT_SECRET="$SECRET_NAME:latest"

echo "--------------------------------------------------"
if [ $? -eq 0 ]; then
  echo "✅ Deployment Successful!"
else
  echo "❌ Deployment Failed!"
fi
echo "--------------------------------------------------"