#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
BUCKET_NAME="sci-request-files-prod"
SECRET_NAME="JWT_SECRET"
FRONTEND_URL="*"

# ✅ 1. เพิ่มชื่อ Secret ของ Key ที่เราสร้างไว้ใน Google Cloud Secret Manager
# (ต้องตรงกับชื่อที่คุณตั้งตอนสร้าง Secret)
PRIV_KEY_SECRET="Gb_PRIVATE_KEY_BASE64"
PUB_KEY_SECRET="Gb_PUBLIC_KEY_BASE64"

# ✅ 2. App Region: รันที่สิงคโปร์เหมือนเดิม
REGION="asia-southeast1"

# ✅ 3. AI Region: ชี้ไปที่ US
AI_LOCATION="us-central1"

echo "--------------------------------------------------"
echo "🚀 Starting deployment for $SERVICE_NAME..."
echo "📍 App Region: $REGION (Singapore)"
echo "🧠 AI Region: $AI_LOCATION (US)"
echo "MJ  Security: Using Secret Manager for Keys"
echo "--------------------------------------------------"

if ! command -v gcloud &> /dev/null
then
    echo "❌ Error: gcloud CLI is not installed."
    exit 1
fi

echo "🚀 Deploying to Cloud Run..."

# ✅ 4. เพิ่ม --set-secrets เพื่อดึง Key มา inject เป็น Env Vars
if gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID="$PROJECT_ID" \
  --set-env-vars GCS_BUCKET_NAME="$BUCKET_NAME" \
  --set-env-vars GCP_LOCATION="$AI_LOCATION" \
  --set-env-vars FRONTEND_URL="$FRONTEND_URL" \
  --set-secrets JWT_SECRET="$SECRET_NAME:latest" \
  --set-secrets Gb_PRIVATE_KEY_BASE64="$PRIV_KEY_SECRET:latest" \
  --set-secrets Gb_PUBLIC_KEY_BASE64="$PUB_KEY_SECRET:latest"; then
  
  echo "--------------------------------------------------"
  echo "✅ Deployment Successful!"
else
  echo "--------------------------------------------------"
  echo "❌ Deployment Failed! Please check the logs above."
  echo "👉 Tip: Make sure the Cloud Run Service Account has 'Secret Manager Secret Accessor' role."
  exit 1
fi