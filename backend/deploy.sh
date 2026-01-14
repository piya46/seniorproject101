#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
BUCKET_NAME="sci-request-files-prod"
SECRET_NAME="JWT_SECRET"
FRONTEND_URL="*"

# ✅ 1. App Region (Cloud Run): รันที่สิงคโปร์
REGION="asia-southeast1"

# ✅ 2. AI Region (Vertex AI): ใช้สิงคโปร์เพื่อให้ Server กับ AI อยู่ที่เดียวกัน (Latency ต่ำ)
AI_LOCATION="asia-southeast1"

echo "--------------------------------------------------"
echo "🚀 Starting deployment for $SERVICE_NAME..."
echo "📍 App Region: $REGION"
echo "🧠 AI Region: $AI_LOCATION"
echo "--------------------------------------------------"

# ตรวจสอบ gcloud
if ! command -v gcloud &> /dev/null
then
    echo "❌ Error: gcloud CLI is not installed."
    exit 1
fi

# รันคำสั่ง Deploy
echo "🚀 Deploying to Cloud Run..."

# แก้ไข: ลบ --no-cache ออก และจัดระเบียบ \ ให้ถูกต้อง
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