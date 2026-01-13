#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION (ตั้งค่าตรงนี้ครั้งเดียว)
# ==========================================

# 1. ชื่อ Project ID ใน Google Cloud ของคุณ
PROJECT_ID="seniorproject101"

# 2. ชื่อ Service ที่ต้องการให้แสดงใน Cloud Run
SERVICE_NAME="sci-request-system"

# 3. ชื่อ Bucket เก็บไฟล์ (ต้องตรงกับที่สร้างไว้)
BUCKET_NAME="sci-request-files-prod"

# 4. Region (แนะนำ asia-southeast1 สิงคโปร์)
REGION="us-central1"

# 5. URL ของ Frontend (ถ้ายังไม่มีใส่ * ไปก่อน)
FRONTEND_URL="*"

# 6. ชื่อ Secret ใน Secret Manager (ต้องสร้างไว้ก่อนแล้ว)
SECRET_NAME="JWT_SECRET"

# ==========================================
# 🚀 START DEPLOYMENT
# ==========================================

echo "--------------------------------------------------"
echo "🚀 Starting deployment for $SERVICE_NAME..."
echo "📍 Region: $REGION"
echo "📦 Project: $PROJECT_ID"
echo "--------------------------------------------------"

# ตรวจสอบว่า Login gcloud หรือยัง
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
  --set-env-vars GCP_LOCATION="$REGION" \
  --set-env-vars FRONTEND_URL="$FRONTEND_URL" \
  --set-secrets JWT_SECRET="$SECRET_NAME:latest"

echo "--------------------------------------------------"
if [ $? -eq 0 ]; then
  echo "✅ Deployment Successful!"
else
  echo "❌ Deployment Failed!"
fi
echo "--------------------------------------------------"