#!/bin/bash

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
BUCKET_NAME="sci-request-files-prod"
SECRET_NAME="JWT_SECRET"
# เพิ่ม Localhost หลายพอร์ตเพื่อให้ยืดหยุ่นตอน Dev
FRONTEND_URL="http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500|http://localhost:5173"

# ชื่อ Secret ของ Key ต่างๆ
PRIV_KEY_SECRET="Gb_PRIVATE_KEY_BASE64"
PUB_KEY_SECRET="Gb_PUBLIC_KEY_BASE64"
DB_KEY_SECRET="DB_ENCRYPTION_KEY"

# 📍 App Region (แนะนำ asia-southeast1 (Singapore) เป็น Main Hub ใกล้ไทยสุดที่มีฟีเจอร์ครบ)
# หากต้องการใช้ Server ไทยแท้ๆ ให้เปลี่ยนเป็น "asia-southeast3" (แต่ต้องเช็ค Quota ของโปรเจ็คก่อน)
REGION="asia-southeast3" 

# 🧠 AI Region (Global)
AI_LOCATION="us-central1"

# สีสำหรับ Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}--------------------------------------------------${NC}"
echo -e "${GREEN}🚀 Starting AUTO-DEPLOY for $SERVICE_NAME...${NC}"
echo -e "📍 App Region: ${YELLOW}$REGION${NC}"
echo -e "🧠 AI Region: ${YELLOW}$AI_LOCATION${NC}"
echo -e "${GREEN}--------------------------------------------------${NC}"

# 1. ตรวจสอบ gcloud และ Login
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed.${NC}"
    exit 1
fi

CURRENT_PROJECT=$(gcloud config get-value project)
echo -e "🔎 Current Project: ${YELLOW}$CURRENT_PROJECT${NC}"

if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  Switching project to $PROJECT_ID...${NC}"
    gcloud config set project $PROJECT_ID
fi

# 2. เปิด APIs ที่จำเป็น (Enable APIs)
echo -e "${YELLOW}🛠️  Enabling required APIs... (This may take a minute)${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    aiplatform.googleapis.com \
    storage.googleapis.com

# 3. สร้าง Bucket (ถ้ายังไม่มี)
echo -e "${YELLOW}📦 Checking Cloud Storage Bucket...${NC}"
if ! gcloud storage buckets describe gs://$BUCKET_NAME &> /dev/null; then
    echo -e "   Creating bucket gs://$BUCKET_NAME..."
    gcloud storage buckets create gs://$BUCKET_NAME --location=$REGION
else
    echo -e "   ✅ Bucket exists."
fi

# 4. ฟังก์ชันสำหรับสร้าง Secret แบบ Auto
create_secret_if_missing() {
    local NAME=$1
    local VALUE=$2
    
    # เช็คว่ามี Secret อยู่แล้วไหม
    if ! gcloud secrets describe $NAME &> /dev/null; then
        echo -e "   🔑 Creating Secret: $NAME..."
        echo -n "$VALUE" | gcloud secrets create $NAME --replication-policy="automatic" --data-file=-
    else
        echo -e "   ✅ Secret $NAME already exists. Skipping."
    fi
}

# 5. จัดการ Secrets และ Keys
echo -e "${YELLOW}🔐 Managing Secrets & Keys...${NC}"

# 5.1 JWT Secret (สุ่มใหม่ถ้าไม่มี)
RANDOM_JWT=$(openssl rand -base64 32)
create_secret_if_missing $SECRET_NAME "$RANDOM_JWT"

# 5.2 DB Encryption Key (สุ่ม Hex 32 bytes)
RANDOM_DB_KEY=$(openssl rand -hex 32)
create_secret_if_missing $DB_KEY_SECRET "$RANDOM_DB_KEY"

# 5.3 RSA Key Pair (สร้างจริงด้วย OpenSSL ถ้าไม่มี)
# ตรวจสอบว่ามี Private Key หรือยัง ถ้ายังไม่มี ให้สร้างใหม่ทั้งคู่
if ! gcloud secrets describe $PRIV_KEY_SECRET &> /dev/null; then
    echo -e "   ⚙️  Generating NEW RSA Key Pair..."
    
    # สร้าง keys ชั่วคราว
    openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in private_key.pem -out public_key.pem
    
    # แปลงเป็น Base64 แบบบรรทัดเดียว (สำหรับ Env Var)
    PRIV_B64=$(base64 -w 0 private_key.pem)
    PUB_B64=$(base64 -w 0 public_key.pem)
    
    # อัปโหลดขึ้น Secret Manager
    create_secret_if_missing $PRIV_KEY_SECRET "$PRIV_B64"
    create_secret_if_missing $PUB_KEY_SECRET "$PUB_B64"
    
    # ลบไฟล์ชั่วคราว
    rm private_key.pem public_key.pem
else
    echo -e "   ✅ RSA Keys already exist."
fi

# 6. ตั้งค่า IAM (สิทธิ์การเข้าถึง)
echo -e "${YELLOW}👮 Configuring Service Account Permissions...${NC}"

# หา Default Service Account ของ Cloud Run (Default Compute SA)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo -e "   Service Account: $SERVICE_ACCOUNT"

# ให้สิทธิ์เข้าถึง Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" &> /dev/null

# ให้สิทธิ์เข้าถึง Storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/storage.objectAdmin" &> /dev/null

# ให้สิทธิ์เข้าถึง AI (Vertex AI)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/aiplatform.user" &> /dev/null

# ให้สิทธิ์เข้าถึง Firestore (Datastore)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/datastore.user" &> /dev/null

echo -e "   ✅ Permissions granted."

# 7. Deploy to Cloud Run
echo -e "${GREEN}🚀 Deploying to Cloud Run...${NC}"

gcloud run deploy "$SERVICE_NAME" \
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
  --set-secrets Gb_PUBLIC_KEY_BASE64="$PUB_KEY_SECRET:latest" \
  --set-secrets DB_ENCRYPTION_KEY="$DB_KEY_SECRET:latest"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}--------------------------------------------------${NC}"
  echo -e "${GREEN}✅ Deployment Successful!${NC}"
  echo -e "${GREEN}--------------------------------------------------${NC}"
else
  echo -e "${RED}--------------------------------------------------${NC}"
  echo -e "${RED}❌ Deployment Failed!${NC}"
  exit 1
fi