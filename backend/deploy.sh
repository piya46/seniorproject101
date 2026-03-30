#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
# แก้ค่าได้ 2 วิธี:
# 1) แก้ default ในไฟล์นี้โดยตรง
# 2) ส่ง env ตอนรัน เช่น SMTP_HOST_VALUE=mail.example.com ./deploy.sh
PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
APP_NAME="${APP_NAME:-ai-formcheck}"
SERVICE_NAME="${SERVICE_NAME:-${APP_NAME}-backend}"
FRONTEND_SERVICE_NAME="${FRONTEND_SERVICE_NAME:-${APP_NAME}-frontend}"
FRONTEND_SERVICE_ACCOUNT_NAME="${FRONTEND_SERVICE_ACCOUNT_NAME:-${FRONTEND_SERVICE_NAME}-sa}"
FRONTEND_INVOKER_SERVICE_ACCOUNT="${FRONTEND_INVOKER_SERVICE_ACCOUNT:-}"
BUCKET_NAME="${BUCKET_NAME:-${SERVICE_NAME}-files}"
BUCKET_LOCATION="${BUCKET_LOCATION:-}"
BUCKET_STORAGE_CLASS="${BUCKET_STORAGE_CLASS:-STANDARD}"
FIRESTORE_DATABASE_ID="${FIRESTORE_DATABASE_ID:-${APP_NAME}}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-}"
FIRESTORE_TYPE="${FIRESTORE_TYPE:-firestore-native}"
FIRESTORE_COLLECTION_NAME="${FIRESTORE_COLLECTION_NAME:-SESSION}"
FIRESTORE_FILES_SUBCOLLECTION="${FIRESTORE_FILES_SUBCOLLECTION:-files}"
ENABLE_FIRESTORE_TTL_POLICIES="${ENABLE_FIRESTORE_TTL_POLICIES:-true}"
AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH="${AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH:-false}"
ENABLE_BUCKET_LIFECYCLE_CLEANUP="${ENABLE_BUCKET_LIFECYCLE_CLEANUP:-false}"
BUCKET_DELETE_AFTER_DAYS="${BUCKET_DELETE_AFTER_DAYS:-1}"
BUCKET_LIFECYCLE_FILE="${BUCKET_LIFECYCLE_FILE:-$SCRIPT_DIR/scripts/lifecycle.json}"
ENABLE_DAILY_FILE_CLEANUP_FUNCTION="${ENABLE_DAILY_FILE_CLEANUP_FUNCTION:-true}"
CLEANUP_SERVICE_NAME="${CLEANUP_SERVICE_NAME:-${SERVICE_NAME}-cleanup}"
CLEANUP_SERVICE_REGION="${CLEANUP_SERVICE_REGION:-}"
CLEANUP_SERVICE_SOURCE_DIR="${CLEANUP_SERVICE_SOURCE_DIR:-$SCRIPT_DIR/services/delete-file-cleanup}"
CLEANUP_SERVICE_ACCOUNT_NAME="${CLEANUP_SERVICE_ACCOUNT_NAME:-${APP_NAME}-cln-sa}"
APP_SERVICE_ACCOUNT_NAME="${APP_SERVICE_ACCOUNT_NAME:-${SERVICE_NAME}-sa}"
CLEANUP_SCHEDULER_JOB_NAME="${CLEANUP_SCHEDULER_JOB_NAME:-${CLEANUP_SERVICE_NAME}-daily}"
CLEANUP_SCHEDULER_LOCATION="${CLEANUP_SCHEDULER_LOCATION:-}"
CLEANUP_SCHEDULER_FALLBACK_LOCATION="${CLEANUP_SCHEDULER_FALLBACK_LOCATION:-asia-southeast1}"
CLEANUP_SCHEDULE_CRON="${CLEANUP_SCHEDULE_CRON:-0 3 * * *}"
CLEANUP_TIME_ZONE="${CLEANUP_TIME_ZONE:-Asia/Bangkok}"
CLEANUP_INVOKER_SERVICE_ACCOUNT="${CLEANUP_INVOKER_SERVICE_ACCOUNT:-}"
ENABLE_BUCKET_MIGRATION="${ENABLE_BUCKET_MIGRATION:-false}"
BUCKET_MIGRATION_SOURCE_NAME="${BUCKET_MIGRATION_SOURCE_NAME:-}"
DELETE_SOURCE_BUCKET_AFTER_MIGRATION="${DELETE_SOURCE_BUCKET_AFTER_MIGRATION:-false}"
ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION="${ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION:-false}"
BUCKET_MIGRATION_TEMP_NAME="${BUCKET_MIGRATION_TEMP_NAME:-}"
DELETE_TEMP_BUCKET_AFTER_MIGRATION="${DELETE_TEMP_BUCKET_AFTER_MIGRATION:-true}"
AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET="${AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET:-false}"
SECRET_NAME="${SECRET_NAME:-JWT_SECRET}"
# ถ้าไม่กำหนด FRONTEND_URL สคริปต์จะ derive จาก FRONTEND_SERVICE_NAME เป็น Cloud Run run.app URL ให้
FRONTEND_URL="${FRONTEND_URL:-}"
FRONTEND_EXTRA_URLS="${FRONTEND_EXTRA_URLS:-}"
TECH_SUPPORT_TARGET_EMAIL="${TECH_SUPPORT_TARGET_EMAIL:-piyaton56@gmail.com}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_SECURE="${SMTP_SECURE:-true}"
SMTP_HOST_VALUE="${SMTP_HOST_VALUE:-}"
SMTP_USER_VALUE="${SMTP_USER_VALUE:-}"
SMTP_FROM_EMAIL_VALUE="${SMTP_FROM_EMAIL_VALUE:-}"
SMTP_FROM_NAME_VALUE="${SMTP_FROM_NAME_VALUE:-แจ้งปัญหา/ข้อเสนอแนะ}"
SMTP_PASS_VALUE="${SMTP_PASS_VALUE:-}"
NODE_ENV="${NODE_ENV:-production}"
OIDC_ENABLED="${OIDC_ENABLED:-true}"
OIDC_ALLOWED_DOMAINS="${OIDC_ALLOWED_DOMAINS:-chula.ac.th,student.chula.ac.th}"
OIDC_REQUIRE_HOSTED_DOMAIN="${OIDC_REQUIRE_HOSTED_DOMAIN:-true}"
ALLOW_BEARER_SESSION_TOKEN="${ALLOW_BEARER_SESSION_TOKEN:-false}"
GOOGLE_OIDC_CLIENT_ID_VALUE="${GOOGLE_OIDC_CLIENT_ID_VALUE:-}"
GOOGLE_OIDC_CLIENT_SECRET_VALUE="${GOOGLE_OIDC_CLIENT_SECRET_VALUE:-}"
GOOGLE_OIDC_CALLBACK_URL="${GOOGLE_OIDC_CALLBACK_URL:-}"
TRUSTED_BFF_AUTH_ENABLED="${TRUSTED_BFF_AUTH_ENABLED:-true}"
TRUSTED_BFF_AUTH_HEADER_NAME="${TRUSTED_BFF_AUTH_HEADER_NAME:-x-bff-auth}"
TRUSTED_BFF_SHARED_SECRET_VALUE="${TRUSTED_BFF_SHARED_SECRET_VALUE:-}"
CLOUD_RUN_INGRESS="${CLOUD_RUN_INGRESS:-all}"
CLOUD_RUN_AUTH_MODE="${CLOUD_RUN_AUTH_MODE:-private}"
TRUST_PROXY="${TRUST_PROXY:-1}"
COOKIE_SAME_SITE="${COOKIE_SAME_SITE:-Lax}"
COOKIE_SECURE="${COOKIE_SECURE:-true}"
TRUST_PROXY_BROWSER_ORIGIN_HEADER="${TRUST_PROXY_BROWSER_ORIGIN_HEADER:-false}"
BROWSER_ORIGIN_HEADER_NAME="${BROWSER_ORIGIN_HEADER_NAME:-x-browser-origin}"
POST_DEPLOY_HEALTHCHECK_ENABLED="${POST_DEPLOY_HEALTHCHECK_ENABLED:-false}"
POST_DEPLOY_HEALTHCHECK_PATH="${POST_DEPLOY_HEALTHCHECK_PATH:-/healthz}"
SKIP_ENABLE_APIS="${SKIP_ENABLE_APIS:-false}"
SKIP_PROJECT_IAM_BINDINGS="${SKIP_PROJECT_IAM_BINDINGS:-false}"

# ชื่อ Secret ของ Key ต่างๆ
PRIV_KEY_SECRET="${PRIV_KEY_SECRET:-Gb_PRIVATE_KEY_BASE64}"
PUB_KEY_SECRET="${PUB_KEY_SECRET:-Gb_PUBLIC_KEY_BASE64}"
PREV_PRIV_KEY_SECRET="${PREV_PRIV_KEY_SECRET:-Gb_PREVIOUS_PRIVATE_KEY_BASE64}"
PREV_PUB_KEY_SECRET="${PREV_PUB_KEY_SECRET:-Gb_PREVIOUS_PUBLIC_KEY_BASE64}"
DB_KEY_SECRET="${DB_KEY_SECRET:-DB_ENCRYPTION_KEY}"
SMTP_HOST_SECRET="${SMTP_HOST_SECRET:-SMTP_HOST}"
SMTP_USER_SECRET="${SMTP_USER_SECRET:-SMTP_USER}"
SMTP_PASS_SECRET="${SMTP_PASS_SECRET:-SMTP_PASS}"
SMTP_FROM_EMAIL_SECRET="${SMTP_FROM_EMAIL_SECRET:-SMTP_FROM_EMAIL}"
SMTP_FROM_NAME_SECRET="${SMTP_FROM_NAME_SECRET:-SMTP_FROM_NAME}"
TECH_SUPPORT_TARGET_EMAIL_SECRET="${TECH_SUPPORT_TARGET_EMAIL_SECRET:-TECH_SUPPORT_TARGET_EMAIL}"
OIDC_CLIENT_ID_SECRET="${OIDC_CLIENT_ID_SECRET:-GOOGLE_OIDC_CLIENT_ID}"
OIDC_CLIENT_SECRET_SECRET="${OIDC_CLIENT_SECRET_SECRET:-GOOGLE_OIDC_CLIENT_SECRET}"
TRUSTED_BFF_SHARED_SECRET_SECRET="${TRUSTED_BFF_SHARED_SECRET_SECRET:-TRUSTED_BFF_SHARED_SECRET}"

# 📍 App Region (แนะนำ asia-southeast1 (Singapore) เป็น Main Hub ใกล้ไทยสุดที่มีฟีเจอร์ครบ)
# หากต้องการใช้ Server ไทยแท้ๆ ให้เปลี่ยนเป็น "asia-southeast3" (แต่ต้องเช็ค Quota ของโปรเจ็คก่อน)
REGION="${REGION:-asia-southeast3}" 

# 🧠 AI Location for Vertex Generative AI
AI_LOCATION="${AI_LOCATION:-us-central1}"
AI_DAILY_TOKEN_LIMIT="${AI_DAILY_TOKEN_LIMIT:-50000}"
AI_USAGE_RETENTION_DAYS="${AI_USAGE_RETENTION_DAYS:-30}"

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

trim_value() {
    local VALUE=$1
    printf '%s' "$VALUE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

derive_canonical_run_app_base_url() {
    local SERVICE_NAME_VALUE=$1
    local PROJECT_NUMBER_VALUE=$2
    printf 'https://%s-%s.%s.run.app' "$SERVICE_NAME_VALUE" "$PROJECT_NUMBER_VALUE" "$REGION"
}

APP_NAME="$(trim_value "$APP_NAME")"
FRONTEND_SERVICE_NAME="$(trim_value "$FRONTEND_SERVICE_NAME")"
FRONTEND_SERVICE_ACCOUNT_NAME="$(trim_value "$FRONTEND_SERVICE_ACCOUNT_NAME")"
FRONTEND_INVOKER_SERVICE_ACCOUNT="$(trim_value "$FRONTEND_INVOKER_SERVICE_ACCOUNT")"
SMTP_HOST_VALUE="$(trim_value "$SMTP_HOST_VALUE")"
SMTP_USER_VALUE="$(trim_value "$SMTP_USER_VALUE")"
SMTP_FROM_EMAIL_VALUE="$(trim_value "$SMTP_FROM_EMAIL_VALUE")"
SMTP_FROM_NAME_VALUE="$(trim_value "$SMTP_FROM_NAME_VALUE")"
SMTP_PORT="$(trim_value "$SMTP_PORT")"
SMTP_SECURE="$(trim_value "$SMTP_SECURE")"
NODE_ENV="$(trim_value "$NODE_ENV")"
TECH_SUPPORT_TARGET_EMAIL="$(trim_value "$TECH_SUPPORT_TARGET_EMAIL")"
FRONTEND_URL="$(trim_value "$FRONTEND_URL")"
FRONTEND_EXTRA_URLS="$(trim_value "$FRONTEND_EXTRA_URLS")"
OIDC_ENABLED="$(trim_value "$OIDC_ENABLED")"
OIDC_ALLOWED_DOMAINS="$(trim_value "$OIDC_ALLOWED_DOMAINS")"
OIDC_REQUIRE_HOSTED_DOMAIN="$(trim_value "$OIDC_REQUIRE_HOSTED_DOMAIN")"
ALLOW_BEARER_SESSION_TOKEN="$(trim_value "$ALLOW_BEARER_SESSION_TOKEN")"
GOOGLE_OIDC_CLIENT_ID_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_ID_VALUE")"
GOOGLE_OIDC_CLIENT_SECRET_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_SECRET_VALUE")"
GOOGLE_OIDC_CALLBACK_URL="$(trim_value "$GOOGLE_OIDC_CALLBACK_URL")"
TRUSTED_BFF_AUTH_ENABLED="$(trim_value "$TRUSTED_BFF_AUTH_ENABLED")"
TRUSTED_BFF_AUTH_HEADER_NAME="$(trim_value "$TRUSTED_BFF_AUTH_HEADER_NAME")"
TRUSTED_BFF_SHARED_SECRET_VALUE="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_VALUE")"
CLOUD_RUN_AUTH_MODE="$(trim_value "$CLOUD_RUN_AUTH_MODE")"
TRUST_PROXY="$(trim_value "$TRUST_PROXY")"
COOKIE_SAME_SITE="$(trim_value "$COOKIE_SAME_SITE")"
COOKIE_SECURE="$(trim_value "$COOKIE_SECURE")"
TRUST_PROXY_BROWSER_ORIGIN_HEADER="$(trim_value "$TRUST_PROXY_BROWSER_ORIGIN_HEADER")"
BROWSER_ORIGIN_HEADER_NAME="$(trim_value "$BROWSER_ORIGIN_HEADER_NAME")"
OIDC_CLIENT_ID_SECRET="$(trim_value "$OIDC_CLIENT_ID_SECRET")"
OIDC_CLIENT_SECRET_SECRET="$(trim_value "$OIDC_CLIENT_SECRET_SECRET")"
TRUSTED_BFF_SHARED_SECRET_SECRET="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_SECRET")"
BUCKET_LOCATION="$(trim_value "$BUCKET_LOCATION")"
BUCKET_STORAGE_CLASS="$(trim_value "$BUCKET_STORAGE_CLASS")"
FIRESTORE_DATABASE_ID="$(trim_value "$FIRESTORE_DATABASE_ID")"
FIRESTORE_LOCATION="$(trim_value "$FIRESTORE_LOCATION")"
FIRESTORE_TYPE="$(trim_value "$FIRESTORE_TYPE")"
FIRESTORE_COLLECTION_NAME="$(trim_value "$FIRESTORE_COLLECTION_NAME")"
FIRESTORE_FILES_SUBCOLLECTION="$(trim_value "$FIRESTORE_FILES_SUBCOLLECTION")"
ENABLE_FIRESTORE_TTL_POLICIES="$(trim_value "$ENABLE_FIRESTORE_TTL_POLICIES")"
AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH="$(trim_value "$AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH")"
ENABLE_BUCKET_LIFECYCLE_CLEANUP="$(trim_value "$ENABLE_BUCKET_LIFECYCLE_CLEANUP")"
BUCKET_DELETE_AFTER_DAYS="$(trim_value "$BUCKET_DELETE_AFTER_DAYS")"
BUCKET_LIFECYCLE_FILE="$(trim_value "$BUCKET_LIFECYCLE_FILE")"
ENABLE_DAILY_FILE_CLEANUP_FUNCTION="$(trim_value "$ENABLE_DAILY_FILE_CLEANUP_FUNCTION")"
CLEANUP_SERVICE_NAME="$(trim_value "$CLEANUP_SERVICE_NAME")"
CLEANUP_SERVICE_REGION="$(trim_value "$CLEANUP_SERVICE_REGION")"
CLEANUP_SERVICE_SOURCE_DIR="$(trim_value "$CLEANUP_SERVICE_SOURCE_DIR")"
CLEANUP_SERVICE_ACCOUNT_NAME="$(trim_value "$CLEANUP_SERVICE_ACCOUNT_NAME")"
APP_SERVICE_ACCOUNT_NAME="$(trim_value "$APP_SERVICE_ACCOUNT_NAME")"
CLEANUP_SCHEDULER_JOB_NAME="$(trim_value "$CLEANUP_SCHEDULER_JOB_NAME")"
CLEANUP_SCHEDULER_LOCATION="$(trim_value "$CLEANUP_SCHEDULER_LOCATION")"
CLEANUP_SCHEDULER_FALLBACK_LOCATION="$(trim_value "$CLEANUP_SCHEDULER_FALLBACK_LOCATION")"
CLEANUP_SCHEDULE_CRON="$(trim_value "$CLEANUP_SCHEDULE_CRON")"
CLEANUP_TIME_ZONE="$(trim_value "$CLEANUP_TIME_ZONE")"
CLEANUP_INVOKER_SERVICE_ACCOUNT="$(trim_value "$CLEANUP_INVOKER_SERVICE_ACCOUNT")"
ENABLE_BUCKET_MIGRATION="$(trim_value "$ENABLE_BUCKET_MIGRATION")"
BUCKET_MIGRATION_SOURCE_NAME="$(trim_value "$BUCKET_MIGRATION_SOURCE_NAME")"
DELETE_SOURCE_BUCKET_AFTER_MIGRATION="$(trim_value "$DELETE_SOURCE_BUCKET_AFTER_MIGRATION")"
ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION="$(trim_value "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION")"
BUCKET_MIGRATION_TEMP_NAME="$(trim_value "$BUCKET_MIGRATION_TEMP_NAME")"
DELETE_TEMP_BUCKET_AFTER_MIGRATION="$(trim_value "$DELETE_TEMP_BUCKET_AFTER_MIGRATION")"
AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET="$(trim_value "$AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET")"
AI_DAILY_TOKEN_LIMIT="$(trim_value "$AI_DAILY_TOKEN_LIMIT")"
AI_USAGE_RETENTION_DAYS="$(trim_value "$AI_USAGE_RETENTION_DAYS")"

if [ -n "$FRONTEND_EXTRA_URLS" ]; then
    FRONTEND_URL="${FRONTEND_URL}|${FRONTEND_EXTRA_URLS}"
fi

CLEANUP_SERVICE_ACCOUNT_EMAIL="${CLEANUP_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
APP_SERVICE_ACCOUNT_EMAIL="${APP_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
FRONTEND_SERVICE_ACCOUNT_EMAIL="${FRONTEND_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if [ -n "$FRONTEND_INVOKER_SERVICE_ACCOUNT" ]; then
    FRONTEND_SERVICE_ACCOUNT_EMAIL="$FRONTEND_INVOKER_SERVICE_ACCOUNT"
fi

if [ -z "$BUCKET_LOCATION" ]; then
    BUCKET_LOCATION="$REGION"
fi

if [ -z "$FIRESTORE_LOCATION" ]; then
    FIRESTORE_LOCATION="$REGION"
fi

if [ -z "$CLEANUP_SERVICE_REGION" ]; then
    CLEANUP_SERVICE_REGION="$REGION"
fi

if [ -z "$CLEANUP_SCHEDULER_LOCATION" ]; then
    CLEANUP_SCHEDULER_LOCATION="$CLEANUP_SERVICE_REGION"
fi

require_command() {
    local NAME=$1
    if ! command -v "$NAME" &> /dev/null; then
        echo -e "${RED}❌ Error: $NAME is not installed.${NC}"
        exit 1
    fi
}

require_gcloud_auth() {
    local ACTIVE_ACCOUNT
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)

    if [ -z "$ACTIVE_ACCOUNT" ]; then
        echo -e "${RED}❌ No active gcloud account found.${NC}"
        echo -e "${YELLOW}ℹ️  Run: gcloud auth login${NC}"
        echo -e "${YELLOW}ℹ️  If needed for ADC-based flows, also run: gcloud auth application-default login${NC}"
        exit 1
    fi

    if ! gcloud auth print-access-token >/dev/null 2>&1; then
        echo -e "${RED}❌ Active gcloud account is present but access token could not be obtained.${NC}"
        echo -e "${YELLOW}ℹ️  Active account: ${ACTIVE_ACCOUNT}${NC}"
        echo -e "${YELLOW}ℹ️  Re-run: gcloud auth login${NC}"
        exit 1
    fi

    echo -e "🔐 Active gcloud account: ${YELLOW}${ACTIVE_ACCOUNT}${NC}"
}

# 1. ตรวจสอบ gcloud และ Login
require_command gcloud
require_command openssl
require_command sed
require_command curl
require_gcloud_auth

CURRENT_PROJECT=$(gcloud config get-value project)
echo -e "🔎 Current Project: ${YELLOW}$CURRENT_PROJECT${NC}"

if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  Switching project to $PROJECT_ID...${NC}"
    gcloud config set project $PROJECT_ID
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CANONICAL_RUN_APP_BASE_URL=$(derive_canonical_run_app_base_url "$SERVICE_NAME" "$PROJECT_NUMBER")
CANONICAL_FRONTEND_RUN_APP_BASE_URL=$(derive_canonical_run_app_base_url "$FRONTEND_SERVICE_NAME" "$PROJECT_NUMBER")

if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="$CANONICAL_FRONTEND_RUN_APP_BASE_URL"
fi

if [ -z "$GOOGLE_OIDC_CALLBACK_URL" ]; then
    GOOGLE_OIDC_CALLBACK_URL="${CANONICAL_RUN_APP_BASE_URL}/api/v1/oidc/google/callback"
fi

# 2. เปิด APIs ที่จำเป็น (Enable APIs)
if [ "$SKIP_ENABLE_APIS" = "true" ]; then
    echo -e "   ℹ️  Skipping API enable step because SKIP_ENABLE_APIS=true"
else
    echo -e "${YELLOW}🛠️  Enabling required APIs... (This may take a minute)${NC}"
    gcloud services enable \
        compute.googleapis.com \
        cloudscheduler.googleapis.com \
        cloudfunctions.googleapis.com \
        artifactregistry.googleapis.com \
        iam.googleapis.com \
        iamcredentials.googleapis.com \
        cloudresourcemanager.googleapis.com \
        iap.googleapis.com \
        run.googleapis.com \
        cloudbuild.googleapis.com \
        secretmanager.googleapis.com \
        firestore.googleapis.com \
        aiplatform.googleapis.com \
        storage.googleapis.com
fi

# 3. ฟังก์ชันสำหรับสร้าง Secret แบบ Auto
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

upsert_secret_value() {
    local NAME=$1
    local VALUE=$2

    if ! gcloud secrets describe "$NAME" &> /dev/null; then
        echo -e "   🔑 Creating Secret: $NAME..."
        echo -n "$VALUE" | gcloud secrets create "$NAME" --replication-policy="automatic" --data-file=-
        return
    fi

    local CURRENT_VALUE
    CURRENT_VALUE=$(gcloud secrets versions access latest --secret="$NAME" 2>/dev/null)

    if [ "$CURRENT_VALUE" = "$VALUE" ]; then
        echo -e "   ✅ Secret $NAME already up to date."
        return
    fi

    echo -e "   ♻️  Updating Secret: $NAME..."
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=-
}

# Backward-compatible alias for older deploy snippets/typos that may still call the legacy name.
psert_secret_value() {
    upsert_secret_value "$@"
}

validate_email() {
    local VALUE=$1
    [[ "$VALUE" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]
}

validate_hostname() {
    local VALUE=$1
    [[ -n "$VALUE" ]] && [[ ! "$VALUE" =~ ^- ]] && [[ ! "$VALUE" =~ [[:space:]] ]] && [[ "$VALUE" =~ ^[A-Za-z0-9.-]+$ ]]
}

validate_boolean_string() {
    local VALUE=$1
    [[ "$VALUE" = "true" || "$VALUE" = "false" ]]
}

validate_cookie_same_site() {
    local VALUE
    VALUE="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    [[ "$VALUE" = "strict" || "$VALUE" = "lax" || "$VALUE" = "none" ]]
}

add_project_iam_policy_binding_if_enabled() {
    local MEMBER=$1
    local ROLE=$2
    local LABEL=$3

    if [ "$SKIP_PROJECT_IAM_BINDINGS" = "true" ]; then
        echo -e "   ℹ️  Skipping project IAM binding for ${YELLOW}$LABEL${NC} because SKIP_PROJECT_IAM_BINDINGS=true"
        return
    fi

    echo -e "   🔐 Granting ${LABEL}"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="$MEMBER" \
        --role="$ROLE" \
        --quiet >/dev/null
}

validate_ingress_setting() {
    local VALUE=$1
    [[ "$VALUE" = "all" || "$VALUE" = "internal" || "$VALUE" = "internal-and-cloud-load-balancing" ]]
}

validate_cloud_run_auth_mode() {
    local VALUE=$1
    [[ "$VALUE" = "public" || "$VALUE" = "private" ]]
}

validate_bucket_storage_class() {
    local VALUE=$1
    [[ "$VALUE" = "STANDARD" || "$VALUE" = "NEARLINE" || "$VALUE" = "COLDLINE" || "$VALUE" = "ARCHIVE" ]]
}

validate_firestore_type() {
    local VALUE=$1
    [[ "$VALUE" = "firestore-native" || "$VALUE" = "datastore-mode" ]]
}

validate_lb_ssl_mode() {
    local VALUE=$1
    [[ "$VALUE" = "managed" || "$VALUE" = "custom" ]]
}

firestore_database_exists() {
    gcloud firestore databases describe \
        --project "$PROJECT_ID" \
        --database "$FIRESTORE_DATABASE_ID" >/dev/null 2>&1
}

wait_for_firestore_database_ready() {
    local MAX_ATTEMPTS=${1:-20}
    local SLEEP_SECONDS=${2:-5}
    local ATTEMPT=1

    while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
        local DATABASE_TYPE
        DATABASE_TYPE=$(gcloud firestore databases describe \
            --project "$PROJECT_ID" \
            --database "$FIRESTORE_DATABASE_ID" \
            --format='value(type)' 2>/dev/null || true)

        if [ -n "$DATABASE_TYPE" ]; then
            echo -e "   ✅ Firestore database is ready: ${YELLOW}$FIRESTORE_DATABASE_ID${NC}"
            return
        fi

        echo -e "   ⏳ Waiting for Firestore database readiness (${ATTEMPT}/${MAX_ATTEMPTS}): ${YELLOW}$FIRESTORE_DATABASE_ID${NC}"
        sleep "$SLEEP_SECONDS"
        ATTEMPT=$((ATTEMPT + 1))
    done

    echo -e "${RED}❌ Firestore database did not become ready in time: $FIRESTORE_DATABASE_ID${NC}"
    exit 1
}

ensure_firestore_database() {
    echo -e "${YELLOW}🗄️  Checking Firestore database...${NC}"

    if firestore_database_exists; then
        local CURRENT_LOCATION
        local CURRENT_TYPE
        CURRENT_LOCATION=$(gcloud firestore databases describe \
            --project "$PROJECT_ID" \
            --database "$FIRESTORE_DATABASE_ID" \
            --format='value(locationId)' 2>/dev/null || true)
        CURRENT_TYPE=$(gcloud firestore databases describe \
            --project "$PROJECT_ID" \
            --database "$FIRESTORE_DATABASE_ID" \
            --format='value(type)' 2>/dev/null || true)

        echo -e "   ✅ Firestore database exists: ${YELLOW}$FIRESTORE_DATABASE_ID${NC}"
        [ -n "$CURRENT_LOCATION" ] && echo -e "   📍 Firestore location      : ${YELLOW}$CURRENT_LOCATION${NC}"
        [ -n "$CURRENT_TYPE" ] && echo -e "   🧱 Firestore type          : ${YELLOW}$CURRENT_TYPE${NC}"
        return
    fi

    echo -e "   Creating Firestore database ${YELLOW}$FIRESTORE_DATABASE_ID${NC} in ${YELLOW}$FIRESTORE_LOCATION${NC}..."
    gcloud firestore databases create \
        --project "$PROJECT_ID" \
        --database="$FIRESTORE_DATABASE_ID" \
        --location="$FIRESTORE_LOCATION" \
        --type="$FIRESTORE_TYPE"

    wait_for_firestore_database_ready
}

ensure_firestore_ttl_policy() {
    local COLLECTION_GROUP=$1
    local FIELD_NAME=$2

    echo -e "   ⏳ Ensuring Firestore TTL: ${YELLOW}${COLLECTION_GROUP}.${FIELD_NAME}${NC}"
    gcloud firestore fields ttls update "$FIELD_NAME" \
        --project "$PROJECT_ID" \
        --database "$FIRESTORE_DATABASE_ID" \
        --collection-group "$COLLECTION_GROUP" \
        --enable-ttl
}

ensure_firestore_ttl_policies() {
    if [ "$ENABLE_FIRESTORE_TTL_POLICIES" != "true" ]; then
        echo -e "   ℹ️  Skipping Firestore TTL policies because ENABLE_FIRESTORE_TTL_POLICIES=false"
        return
    fi

    echo -e "${YELLOW}⏳ Configuring Firestore TTL policies...${NC}"
    ensure_firestore_ttl_policy "used_nonces" "expire_at"
    ensure_firestore_ttl_policy "RATE_LIMITS" "expireAt"
    ensure_firestore_ttl_policy "AI_USAGE_DAILY" "expire_at"
}

ensure_bucket_exists() {
    local TARGET_BUCKET_NAME=$1
    local TARGET_BUCKET_LOCATION=$2
    local TARGET_BUCKET_STORAGE_CLASS=$3

    if ! gcloud storage buckets describe "gs://$TARGET_BUCKET_NAME" &> /dev/null; then
        echo -e "   Creating bucket gs://$TARGET_BUCKET_NAME..."
        gcloud storage buckets create "gs://$TARGET_BUCKET_NAME" \
            --location="$TARGET_BUCKET_LOCATION" \
            --default-storage-class="$TARGET_BUCKET_STORAGE_CLASS"
    else
        echo -e "   ✅ Bucket exists: gs://$TARGET_BUCKET_NAME"
    fi
}

wait_for_bucket_availability() {
    local TARGET_BUCKET_NAME=$1
    local MAX_ATTEMPTS=${2:-20}
    local SLEEP_SECONDS=${3:-3}
    local ATTEMPT=1

    while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
        if gcloud storage buckets describe "gs://$TARGET_BUCKET_NAME" >/dev/null 2>&1; then
            echo -e "   ✅ Bucket is available: gs://$TARGET_BUCKET_NAME"
            return
        fi

        echo -e "   ⏳ Waiting for bucket availability (${ATTEMPT}/${MAX_ATTEMPTS}): gs://$TARGET_BUCKET_NAME"
        sleep "$SLEEP_SECONDS"
        ATTEMPT=$((ATTEMPT + 1))
    done

    echo -e "${RED}❌ Bucket did not become available in time: gs://$TARGET_BUCKET_NAME${NC}"
    exit 1
}

bucket_exists() {
    local TARGET_BUCKET_NAME=$1
    gcloud storage buckets describe "gs://$TARGET_BUCKET_NAME" >/dev/null 2>&1
}

bucket_has_objects() {
    local TARGET_BUCKET_NAME=$1
    if ! bucket_exists "$TARGET_BUCKET_NAME"; then
        return 1
    fi

    gcloud storage ls --recursive "gs://$TARGET_BUCKET_NAME" 2>/dev/null | head -n 1 | grep -q '.'
}

cleanup_bucket_if_requested() {
    local TARGET_BUCKET_NAME=$1

    if ! bucket_exists "$TARGET_BUCKET_NAME"; then
        return
    fi

    gcloud storage rm "gs://$TARGET_BUCKET_NAME/**" --recursive || true
    gcloud storage buckets delete "gs://$TARGET_BUCKET_NAME"
}

normalize_bucket_location() {
    local VALUE=$1
    printf '%s' "$VALUE" | tr '[:lower:]' '[:upper:]'
}

derive_temp_bucket_name() {
    local BASE_NAME=$1
    local TARGET_LOCATION=$2
    local SANITIZED_LOCATION
    SANITIZED_LOCATION=$(printf '%s' "$TARGET_LOCATION" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')
    printf '%.63s' "${BASE_NAME}-${SANITIZED_LOCATION}-migrate-tmp"
}

resolve_bucket_lifecycle_file() {
    if [ -f "$BUCKET_LIFECYCLE_FILE" ]; then
        printf '%s' "$BUCKET_LIFECYCLE_FILE"
        return
    fi

    local GENERATED_LIFECYCLE_FILE
    GENERATED_LIFECYCLE_FILE=$(mktemp /tmp/sci-request-bucket-lifecycle.XXXXXX.json)
    cat > "$GENERATED_LIFECYCLE_FILE" <<EOF
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": $BUCKET_DELETE_AFTER_DAYS }
    }
  ]
}
EOF
    echo -e "${YELLOW}   ℹ️  Bucket lifecycle file not found. Generated fallback policy at $GENERATED_LIFECYCLE_FILE${NC}" >&2
    printf '%s' "$GENERATED_LIFECYCLE_FILE"
}

print_existing_bucket_metadata() {
    local TARGET_BUCKET_NAME=$1
    local CURRENT_LOCATION
    local CURRENT_STORAGE_CLASS
    local NORMALIZED_CURRENT_LOCATION
    local NORMALIZED_TARGET_LOCATION

    CURRENT_LOCATION=$(gcloud storage buckets describe "gs://$TARGET_BUCKET_NAME" --format='value(location)' 2>/dev/null || true)
    CURRENT_STORAGE_CLASS=$(gcloud storage buckets describe "gs://$TARGET_BUCKET_NAME" --format='value(storageClass)' 2>/dev/null || true)
    NORMALIZED_CURRENT_LOCATION=$(normalize_bucket_location "$CURRENT_LOCATION")
    NORMALIZED_TARGET_LOCATION=$(normalize_bucket_location "$BUCKET_LOCATION")

    EXISTING_BUCKET_LOCATION="$CURRENT_LOCATION"
    EXISTING_BUCKET_STORAGE_CLASS="$CURRENT_STORAGE_CLASS"

    if [ -n "$CURRENT_LOCATION" ]; then
        echo -e "   📍 Existing bucket location: ${YELLOW}$CURRENT_LOCATION${NC}"
    fi

    if [ -n "$CURRENT_STORAGE_CLASS" ]; then
        echo -e "   🗂️  Existing storage class: ${YELLOW}$CURRENT_STORAGE_CLASS${NC}"
    fi

    if [ -n "$CURRENT_LOCATION" ] && [ "$NORMALIZED_CURRENT_LOCATION" != "$NORMALIZED_TARGET_LOCATION" ]; then
        echo -e "${YELLOW}   ⚠️  Bucket location mismatch. Existing: $CURRENT_LOCATION, Expected: $BUCKET_LOCATION${NC}"
        echo -e "${YELLOW}   ℹ️  Bucket location cannot be changed in-place. Reusing existing bucket.${NC}"
    fi

    if [ -n "$CURRENT_STORAGE_CLASS" ] && [ "$CURRENT_STORAGE_CLASS" != "$BUCKET_STORAGE_CLASS" ]; then
        echo -e "${YELLOW}   ⚠️  Bucket storage class mismatch. Existing: $CURRENT_STORAGE_CLASS, Expected: $BUCKET_STORAGE_CLASS${NC}"
        echo -e "${YELLOW}   ℹ️  Reusing existing bucket with its current storage class.${NC}"
    fi
}

auto_prepare_bucket_migration_if_needed() {
    if [ "$AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH" != "true" ]; then
        return
    fi

    if [ "$ENABLE_BUCKET_MIGRATION" = "true" ] || [ "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION" = "true" ]; then
        return
    fi

    if [ -z "${EXISTING_BUCKET_LOCATION:-}" ]; then
        return
    fi

    local NORMALIZED_EXISTING_LOCATION
    local NORMALIZED_TARGET_LOCATION
    NORMALIZED_EXISTING_LOCATION=$(normalize_bucket_location "$EXISTING_BUCKET_LOCATION")
    NORMALIZED_TARGET_LOCATION=$(normalize_bucket_location "$BUCKET_LOCATION")

    if [ "$NORMALIZED_EXISTING_LOCATION" = "$NORMALIZED_TARGET_LOCATION" ]; then
        return
    fi

    ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION="true"
    if [ -z "$BUCKET_MIGRATION_TEMP_NAME" ]; then
        BUCKET_MIGRATION_TEMP_NAME=$(derive_temp_bucket_name "$BUCKET_NAME" "$BUCKET_LOCATION")
    fi

    AUTO_BUCKET_MIGRATION_TRIGGERED="true"

    echo -e "${YELLOW}   🤖 AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH=true detected.${NC}"
    echo -e "${YELLOW}   ℹ️  Automatically switching to strict same-name bucket migration.${NC}"
    echo -e "${YELLOW}   ℹ️  Temporary bucket: $BUCKET_MIGRATION_TEMP_NAME${NC}"
}

handle_leftover_temp_bucket_if_needed() {
    local TEMP_BUCKET_NAME=${BUCKET_MIGRATION_TEMP_NAME:-$(derive_temp_bucket_name "$BUCKET_NAME" "$BUCKET_LOCATION")}

    if [ "$AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET" != "true" ]; then
        return
    fi

    if [ "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION" = "true" ]; then
        return
    fi

    if [ "$TEMP_BUCKET_NAME" = "$BUCKET_NAME" ]; then
        return
    fi

    if ! bucket_exists "$TEMP_BUCKET_NAME"; then
        return
    fi

    echo -e "${YELLOW}   🧹 Found leftover temporary migration bucket: gs://$TEMP_BUCKET_NAME${NC}"

    if bucket_has_objects "$TEMP_BUCKET_NAME"; then
        if bucket_exists "$BUCKET_NAME"; then
            echo -e "   🔄 Syncing any leftover objects from temp bucket back to main bucket before cleanup..."
            gcloud storage rsync "gs://$TEMP_BUCKET_NAME" "gs://$BUCKET_NAME" --recursive
        else
            echo -e "${YELLOW}   ⚠️  Main bucket does not exist yet. Skipping leftover temp bucket cleanup for now.${NC}"
            return
        fi
    fi

    echo -e "   🗑️  Removing leftover temporary migration bucket: gs://$TEMP_BUCKET_NAME"
    cleanup_bucket_if_requested "$TEMP_BUCKET_NAME"
}

ensure_bucket_lifecycle_policy() {
    local CURRENT_LIFECYCLE
    CURRENT_LIFECYCLE=$(gcloud storage buckets describe "gs://$BUCKET_NAME" --format='json(lifecycle)' 2>/dev/null || true)

    if [ "$ENABLE_BUCKET_LIFECYCLE_CLEANUP" != "true" ]; then
        if printf '%s' "$CURRENT_LIFECYCLE" | grep -q '"rule"'; then
            echo -e "   🧼 Clearing existing bucket lifecycle policy because ENABLE_BUCKET_LIFECYCLE_CLEANUP=false"
            gcloud storage buckets update "gs://$BUCKET_NAME" --clear-lifecycle
        else
            echo -e "   ℹ️  Skipping bucket lifecycle cleanup because ENABLE_BUCKET_LIFECYCLE_CLEANUP=false"
        fi
        return
    fi

    local RESOLVED_LIFECYCLE_FILE
    RESOLVED_LIFECYCLE_FILE=$(resolve_bucket_lifecycle_file)

    if [ ! -f "$RESOLVED_LIFECYCLE_FILE" ]; then
        echo -e "${RED}❌ Lifecycle policy file not found: $RESOLVED_LIFECYCLE_FILE${NC}"
        exit 1
    fi

    if printf '%s' "$CURRENT_LIFECYCLE" | grep -q '"rule"'; then
        echo -e "   🔎 Existing bucket lifecycle policy detected."
    else
        echo -e "   ℹ️  No bucket lifecycle policy detected yet."
    fi

    echo -e "   🧹 Applying bucket lifecycle cleanup policy to gs://$BUCKET_NAME"
    gcloud storage buckets update "gs://$BUCKET_NAME" \
        --lifecycle-file="$RESOLVED_LIFECYCLE_FILE"
}

ensure_cleanup_service_source_exists() {
    if [ ! -f "$CLEANUP_SERVICE_SOURCE_DIR/index.js" ] || [ ! -f "$CLEANUP_SERVICE_SOURCE_DIR/package.json" ]; then
        echo -e "${RED}❌ Cleanup service source is incomplete: $CLEANUP_SERVICE_SOURCE_DIR${NC}"
        exit 1
    fi
}

deploy_cleanup_service() {
    local TARGET_REGION=$1

    gcloud run deploy "$CLEANUP_SERVICE_NAME" \
        --project "$PROJECT_ID" \
        --region "$TARGET_REGION" \
        --source "$CLEANUP_SERVICE_SOURCE_DIR" \
        --port 8080 \
        --ingress all \
        --no-allow-unauthenticated \
        --service-account "$CLEANUP_SERVICE_ACCOUNT_EMAIL" \
        --set-env-vars "GCS_BUCKET_NAME=${BUCKET_NAME},FIRESTORE_DATABASE_ID=${FIRESTORE_DATABASE_ID},FIRESTORE_COLLECTION_NAME=${FIRESTORE_COLLECTION_NAME},FIRESTORE_FILES_SUBCOLLECTION=${FIRESTORE_FILES_SUBCOLLECTION}"
}

grant_cleanup_service_invoker_binding() {
    local INVOKER_SERVICE_ACCOUNT=$1

    echo -e "   🔐 Granting Cloud Run Invoker to ${YELLOW}$INVOKER_SERVICE_ACCOUNT${NC}"
    gcloud run services add-iam-policy-binding "$CLEANUP_SERVICE_NAME" \
        --region="$CLEANUP_SERVICE_REGION" \
        --project "$PROJECT_ID" \
        --member="serviceAccount:$INVOKER_SERVICE_ACCOUNT" \
        --role="roles/run.invoker" \
        --quiet >/dev/null
}

grant_backend_service_invoker_binding_if_needed() {
    if [ "$CLOUD_RUN_AUTH_MODE" != "private" ]; then
        return
    fi

    if [ -z "$FRONTEND_SERVICE_ACCOUNT_EMAIL" ]; then
        echo -e "${RED}❌ FRONTEND_SERVICE_ACCOUNT_EMAIL could not be resolved for private backend mode.${NC}"
        exit 1
    fi

    echo -e "   🔐 Granting Cloud Run Invoker on backend to ${YELLOW}$FRONTEND_SERVICE_ACCOUNT_EMAIL${NC}"
    gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
        --region="$REGION" \
        --project "$PROJECT_ID" \
        --member="serviceAccount:$FRONTEND_SERVICE_ACCOUNT_EMAIL" \
        --role="roles/run.invoker" \
        --quiet >/dev/null
}

grant_secret_accessor_on_secret() {
    local SECRET_NAME=$1
    local SERVICE_ACCOUNT_EMAIL=$2

    echo -e "   🔐 Granting secret-level secretAccessor on ${YELLOW}$SECRET_NAME${NC}"
    gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
        --project "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet >/dev/null
}

remove_project_secret_accessor_binding_if_exists() {
    local SERVICE_ACCOUNT_EMAIL=$1

    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/secretmanager.secretAccessor" \
        --all \
        --quiet >/dev/null 2>&1 || true
}

grant_service_account_token_creator_on_self() {
    local SERVICE_ACCOUNT_EMAIL=$1

    echo -e "   🔐 Granting serviceAccountTokenCreator on self for signed URL support"
    gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
        --project "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/iam.serviceAccountTokenCreator" \
        --quiet >/dev/null
}

remove_bucket_role_binding_if_exists() {
    local BUCKET_URL=$1
    local SERVICE_ACCOUNT_EMAIL=$2
    local ROLE_NAME=$3

    gcloud storage buckets remove-iam-policy-binding "$BUCKET_URL" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$ROLE_NAME" \
        --all \
        --quiet >/dev/null 2>&1 || true
}

ensure_cleanup_service_account_and_permissions() {
    if ! gcloud iam service-accounts describe "$CLEANUP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "   🔐 Creating dedicated cleanup service account: ${YELLOW}$CLEANUP_SERVICE_ACCOUNT_NAME${NC}"
        gcloud iam service-accounts create "$CLEANUP_SERVICE_ACCOUNT_NAME" \
            --project "$PROJECT_ID" \
            --display-name "Delete File Cleanup Service"
    else
        echo -e "   ✅ Cleanup service account exists: ${YELLOW}$CLEANUP_SERVICE_ACCOUNT_EMAIL${NC}"
    fi

    local ATTEMPT=1
    local MAX_ATTEMPTS=20
    while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
        if gcloud iam service-accounts describe "$CLEANUP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
            break
        fi
        echo -e "   ⏳ Waiting for cleanup service account propagation (${ATTEMPT}/${MAX_ATTEMPTS})..."
        sleep 3
        ATTEMPT=$((ATTEMPT + 1))
    done

    if ! gcloud iam service-accounts describe "$CLEANUP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "${RED}❌ Cleanup service account did not become available in time: $CLEANUP_SERVICE_ACCOUNT_EMAIL${NC}"
        exit 1
    fi

    echo -e "   🔐 Granting bucket-scoped storage.objectUser to cleanup service account"
    gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
        --member="serviceAccount:$CLEANUP_SERVICE_ACCOUNT_EMAIL" \
        --role="roles/storage.objectUser" \
        --quiet >/dev/null
    remove_bucket_role_binding_if_exists "gs://$BUCKET_NAME" "$CLEANUP_SERVICE_ACCOUNT_EMAIL" "roles/storage.objectAdmin"

    add_project_iam_policy_binding_if_enabled \
        "serviceAccount:$CLEANUP_SERVICE_ACCOUNT_EMAIL" \
        "roles/datastore.user" \
        "datastore.user to cleanup service account"
}

ensure_app_service_account_and_permissions() {
    if ! gcloud iam service-accounts describe "$APP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "   🔐 Creating dedicated app service account: ${YELLOW}$APP_SERVICE_ACCOUNT_NAME${NC}"
        gcloud iam service-accounts create "$APP_SERVICE_ACCOUNT_NAME" \
            --project "$PROJECT_ID" \
            --display-name "Sci Request Backend Service"
    else
        echo -e "   ✅ App service account exists: ${YELLOW}$APP_SERVICE_ACCOUNT_EMAIL${NC}"
    fi

    local ATTEMPT=1
    local MAX_ATTEMPTS=20
    while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
        if gcloud iam service-accounts describe "$APP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
            break
        fi
        echo -e "   ⏳ Waiting for app service account propagation (${ATTEMPT}/${MAX_ATTEMPTS})..."
        sleep 3
        ATTEMPT=$((ATTEMPT + 1))
    done

    if ! gcloud iam service-accounts describe "$APP_SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "${RED}❌ App service account did not become available in time: $APP_SERVICE_ACCOUNT_EMAIL${NC}"
        exit 1
    fi

    remove_project_secret_accessor_binding_if_exists "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SECRET_NAME" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$DB_KEY_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$PRIV_KEY_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$PUB_KEY_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SMTP_HOST_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SMTP_USER_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SMTP_PASS_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SMTP_FROM_EMAIL_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$SMTP_FROM_NAME_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$OIDC_CLIENT_ID_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    grant_secret_accessor_on_secret "$OIDC_CLIENT_SECRET_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ]; then
        grant_secret_accessor_on_secret "$TRUSTED_BFF_SHARED_SECRET_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    fi

    if gcloud secrets describe "$PREV_PRIV_KEY_SECRET" --project "$PROJECT_ID" >/dev/null 2>&1; then
        grant_secret_accessor_on_secret "$PREV_PRIV_KEY_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    fi

    if gcloud secrets describe "$PREV_PUB_KEY_SECRET" --project "$PROJECT_ID" >/dev/null 2>&1; then
        grant_secret_accessor_on_secret "$PREV_PUB_KEY_SECRET" "$APP_SERVICE_ACCOUNT_EMAIL"
    fi

    echo -e "   🔐 Granting bucket-scoped storage.objectUser to app service account"
    gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
        --member="serviceAccount:$APP_SERVICE_ACCOUNT_EMAIL" \
        --role="roles/storage.objectUser" \
        --quiet >/dev/null
    remove_bucket_role_binding_if_exists "gs://$BUCKET_NAME" "$APP_SERVICE_ACCOUNT_EMAIL" "roles/storage.objectAdmin"

    add_project_iam_policy_binding_if_enabled \
        "serviceAccount:$APP_SERVICE_ACCOUNT_EMAIL" \
        "roles/aiplatform.user" \
        "aiplatform.user to app service account"

    add_project_iam_policy_binding_if_enabled \
        "serviceAccount:$APP_SERVICE_ACCOUNT_EMAIL" \
        "roles/datastore.user" \
        "datastore.user to app service account"

    grant_service_account_token_creator_on_self "$APP_SERVICE_ACCOUNT_EMAIL"
}

ensure_daily_cleanup_function_and_scheduler() {
    if [ "$ENABLE_DAILY_FILE_CLEANUP_FUNCTION" != "true" ]; then
        echo -e "   ℹ️  Skipping scheduled cleanup function because ENABLE_DAILY_FILE_CLEANUP_FUNCTION=false"
        return
    fi

    ensure_cleanup_service_source_exists
    ensure_cleanup_service_account_and_permissions

    local INVOKER_SERVICE_ACCOUNT=${CLEANUP_INVOKER_SERVICE_ACCOUNT:-$CLEANUP_SERVICE_ACCOUNT_EMAIL}

    echo -e "${YELLOW}🧹 Ensuring daily cleanup service and scheduler...${NC}"
    echo -e "   Cleanup service         : ${YELLOW}$CLEANUP_SERVICE_NAME${NC}"
    echo -e "   Cleanup region          : ${YELLOW}$CLEANUP_SERVICE_REGION${NC}"
    echo -e "   Cleanup service account : ${YELLOW}$CLEANUP_SERVICE_ACCOUNT_EMAIL${NC}"
    echo -e "   Cleanup invoker         : ${YELLOW}$INVOKER_SERVICE_ACCOUNT${NC}"
    echo -e "   Scheduler job           : ${YELLOW}$CLEANUP_SCHEDULER_JOB_NAME${NC}"
    echo -e "   Scheduler location      : ${YELLOW}$CLEANUP_SCHEDULER_LOCATION${NC}"
    echo -e "   Scheduler fallback      : ${YELLOW}$CLEANUP_SCHEDULER_FALLBACK_LOCATION${NC}"
    echo -e "   Schedule                : ${YELLOW}$CLEANUP_SCHEDULE_CRON${NC}"
    echo -e "   Time zone               : ${YELLOW}$CLEANUP_TIME_ZONE${NC}"

    deploy_cleanup_service "$CLEANUP_SERVICE_REGION"

    grant_cleanup_service_invoker_binding "$INVOKER_SERVICE_ACCOUNT"

    local CLEANUP_SERVICE_URL
    CLEANUP_SERVICE_URL=$(gcloud run services describe "$CLEANUP_SERVICE_NAME" \
        --region "$CLEANUP_SERVICE_REGION" \
        --project "$PROJECT_ID" \
        --format='value(status.url)')

    if [ -z "$CLEANUP_SERVICE_URL" ]; then
        echo -e "${RED}❌ Failed to resolve cleanup service URL.${NC}"
        exit 1
    fi

    local SCHEDULER_LOCATION="$CLEANUP_SCHEDULER_LOCATION"
    local SCHEDULER_DEPLOYED="false"
    local SCHEDULER_STDERR_LOG
    SCHEDULER_STDERR_LOG=$(mktemp /tmp/sci-request-scheduler-deploy.XXXXXX)

    if gcloud scheduler jobs describe "$CLEANUP_SCHEDULER_JOB_NAME" --location "$SCHEDULER_LOCATION" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "   ♻️  Updating Cloud Scheduler job: $CLEANUP_SCHEDULER_JOB_NAME"
        if gcloud scheduler jobs update http "$CLEANUP_SCHEDULER_JOB_NAME" \
            --location "$SCHEDULER_LOCATION" \
            --project "$PROJECT_ID" \
            --schedule "$CLEANUP_SCHEDULE_CRON" \
            --time-zone "$CLEANUP_TIME_ZONE" \
            --uri "$CLEANUP_SERVICE_URL" \
            --http-method POST \
            --oidc-service-account-email "$INVOKER_SERVICE_ACCOUNT" \
            --oidc-token-audience "$CLEANUP_SERVICE_URL" \
            2>"$SCHEDULER_STDERR_LOG"; then
            SCHEDULER_DEPLOYED="true"
        fi
    else
        echo -e "   🕒 Creating Cloud Scheduler job: $CLEANUP_SCHEDULER_JOB_NAME"
        if gcloud scheduler jobs create http "$CLEANUP_SCHEDULER_JOB_NAME" \
            --location "$SCHEDULER_LOCATION" \
            --project "$PROJECT_ID" \
            --schedule "$CLEANUP_SCHEDULE_CRON" \
            --time-zone "$CLEANUP_TIME_ZONE" \
            --uri "$CLEANUP_SERVICE_URL" \
            --http-method POST \
            --oidc-service-account-email "$INVOKER_SERVICE_ACCOUNT" \
            --oidc-token-audience "$CLEANUP_SERVICE_URL" \
            2>"$SCHEDULER_STDERR_LOG"; then
            SCHEDULER_DEPLOYED="true"
        fi
    fi

    if [ "$SCHEDULER_DEPLOYED" != "true" ]; then
        if grep -q "is not a valid location" "$SCHEDULER_STDERR_LOG"; then
            echo -e "${YELLOW}   ⚠️  Scheduler location ${SCHEDULER_LOCATION} is unavailable in this project.${NC}"
            echo -e "${YELLOW}   ℹ️  Retrying scheduler in fallback location ${CLEANUP_SCHEDULER_FALLBACK_LOCATION}.${NC}"
            SCHEDULER_LOCATION="$CLEANUP_SCHEDULER_FALLBACK_LOCATION"
            CLEANUP_SCHEDULER_LOCATION="$SCHEDULER_LOCATION"

            if gcloud scheduler jobs describe "$CLEANUP_SCHEDULER_JOB_NAME" --location "$SCHEDULER_LOCATION" --project "$PROJECT_ID" >/dev/null 2>&1; then
                echo -e "   ♻️  Updating Cloud Scheduler job in fallback location: $CLEANUP_SCHEDULER_JOB_NAME"
                gcloud scheduler jobs update http "$CLEANUP_SCHEDULER_JOB_NAME" \
                    --location "$SCHEDULER_LOCATION" \
                    --project "$PROJECT_ID" \
                    --schedule "$CLEANUP_SCHEDULE_CRON" \
                    --time-zone "$CLEANUP_TIME_ZONE" \
                    --uri "$CLEANUP_SERVICE_URL" \
                    --http-method POST \
                    --oidc-service-account-email "$INVOKER_SERVICE_ACCOUNT" \
                    --oidc-token-audience "$CLEANUP_SERVICE_URL"
            else
                echo -e "   🕒 Creating Cloud Scheduler job in fallback location: $CLEANUP_SCHEDULER_JOB_NAME"
                gcloud scheduler jobs create http "$CLEANUP_SCHEDULER_JOB_NAME" \
                    --location "$SCHEDULER_LOCATION" \
                    --project "$PROJECT_ID" \
                    --schedule "$CLEANUP_SCHEDULE_CRON" \
                    --time-zone "$CLEANUP_TIME_ZONE" \
                    --uri "$CLEANUP_SERVICE_URL" \
                    --http-method POST \
                    --oidc-service-account-email "$INVOKER_SERVICE_ACCOUNT" \
                    --oidc-token-audience "$CLEANUP_SERVICE_URL"
            fi
        else
            cat "$SCHEDULER_STDERR_LOG" >&2
            rm -f "$SCHEDULER_STDERR_LOG"
            exit 1
        fi
    fi

    rm -f "$SCHEDULER_STDERR_LOG"

    echo -e "   ✅ Daily cleanup service and scheduler are ready."
    cleanup_legacy_cleanup_resources
}

migrate_bucket_if_requested() {
    if [ "$ENABLE_BUCKET_MIGRATION" != "true" ]; then
        return
    fi

    if [ -z "$BUCKET_MIGRATION_SOURCE_NAME" ]; then
        echo -e "${RED}❌ BUCKET_MIGRATION_SOURCE_NAME is required when ENABLE_BUCKET_MIGRATION=true${NC}"
        exit 1
    fi

    if [ "$BUCKET_MIGRATION_SOURCE_NAME" = "$BUCKET_NAME" ]; then
        echo -e "${RED}❌ BUCKET_MIGRATION_SOURCE_NAME must be different from BUCKET_NAME when migrating across locations.${NC}"
        exit 1
    fi

    if ! gcloud storage buckets describe "gs://$BUCKET_MIGRATION_SOURCE_NAME" &> /dev/null; then
        echo -e "${RED}❌ Source bucket does not exist: gs://$BUCKET_MIGRATION_SOURCE_NAME${NC}"
        exit 1
    fi

    echo -e "${YELLOW}📦 Migrating Cloud Storage bucket data...${NC}"
    echo -e "   Source bucket           : ${YELLOW}$BUCKET_MIGRATION_SOURCE_NAME${NC}"
    echo -e "   Destination bucket      : ${YELLOW}$BUCKET_NAME${NC}"

    ensure_bucket_exists "$BUCKET_NAME" "$BUCKET_LOCATION" "$BUCKET_STORAGE_CLASS"

    echo -e "   🔄 Syncing objects from gs://$BUCKET_MIGRATION_SOURCE_NAME to gs://$BUCKET_NAME..."
    gcloud storage rsync "gs://$BUCKET_MIGRATION_SOURCE_NAME" "gs://$BUCKET_NAME" --recursive

    if [ "$DELETE_SOURCE_BUCKET_AFTER_MIGRATION" = "true" ]; then
        echo -e "${YELLOW}   🗑️  Deleting source bucket after migration: gs://$BUCKET_MIGRATION_SOURCE_NAME${NC}"
        gcloud storage rm "gs://$BUCKET_MIGRATION_SOURCE_NAME/**" --recursive || true
        gcloud storage buckets delete "gs://$BUCKET_MIGRATION_SOURCE_NAME"
    fi

    echo -e "   ✅ Bucket migration completed."
}

migrate_bucket_same_name_if_requested() {
    if [ "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION" != "true" ]; then
        return
    fi

    if [ -z "$BUCKET_MIGRATION_TEMP_NAME" ]; then
        echo -e "${RED}❌ BUCKET_MIGRATION_TEMP_NAME is required when ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION=true${NC}"
        exit 1
    fi

    if [ "$BUCKET_MIGRATION_TEMP_NAME" = "$BUCKET_NAME" ]; then
        echo -e "${RED}❌ BUCKET_MIGRATION_TEMP_NAME must be different from BUCKET_NAME${NC}"
        exit 1
    fi

    echo -e "${RED}⚠️  STRICT SAME-NAME BUCKET MIGRATION ENABLED${NC}"
    echo -e "${RED}⚠️  This flow will cause downtime while bucket ${BUCKET_NAME} is deleted and recreated.${NC}"
    echo -e "   Original bucket         : ${YELLOW}$BUCKET_NAME${NC}"
    echo -e "   Temporary bucket        : ${YELLOW}$BUCKET_MIGRATION_TEMP_NAME${NC}"
    echo -e "   Target location         : ${YELLOW}$BUCKET_LOCATION${NC}"

    if bucket_has_objects "$BUCKET_MIGRATION_TEMP_NAME"; then
        echo -e "   ♻️  Found existing temporary bucket data from a previous migration."

        if bucket_exists "$BUCKET_NAME"; then
            wait_for_bucket_availability "$BUCKET_NAME"
        else
            echo -e "   🪣 Recreating original bucket before restore..."
            ensure_bucket_exists "$BUCKET_NAME" "$BUCKET_LOCATION" "$BUCKET_STORAGE_CLASS"
            wait_for_bucket_availability "$BUCKET_NAME"
        fi

        echo -e "   🔄 Resuming restore from temporary bucket to original bucket..."
        gcloud storage rsync "gs://$BUCKET_MIGRATION_TEMP_NAME" "gs://$BUCKET_NAME" --recursive

        if [ "$DELETE_TEMP_BUCKET_AFTER_MIGRATION" = "true" ]; then
            echo -e "   🧹 Cleaning up temporary bucket after resumed restore: gs://$BUCKET_MIGRATION_TEMP_NAME"
            gcloud storage rm "gs://$BUCKET_MIGRATION_TEMP_NAME/**" --recursive || true
            gcloud storage buckets delete "gs://$BUCKET_MIGRATION_TEMP_NAME"
        else
            echo -e "   ℹ️  Keeping temporary bucket for verification: gs://$BUCKET_MIGRATION_TEMP_NAME"
        fi

        echo -e "   ✅ Strict same-name bucket migration resumed and completed."
        return
    fi

    if ! bucket_exists "$BUCKET_NAME"; then
        echo -e "${RED}❌ Source bucket does not exist for strict same-name migration and no resumable temp bucket was found: gs://$BUCKET_NAME${NC}"
        exit 1
    fi

    ensure_bucket_exists "$BUCKET_MIGRATION_TEMP_NAME" "$BUCKET_LOCATION" "$BUCKET_STORAGE_CLASS"
    wait_for_bucket_availability "$BUCKET_MIGRATION_TEMP_NAME"

    echo -e "   🔄 Step 1/4: Syncing original bucket to temporary bucket..."
    gcloud storage rsync "gs://$BUCKET_NAME" "gs://$BUCKET_MIGRATION_TEMP_NAME" --recursive

    echo -e "   🗑️  Step 2/4: Deleting original bucket ${YELLOW}gs://$BUCKET_NAME${NC}"
    gcloud storage rm "gs://$BUCKET_NAME/**" --recursive || true
    gcloud storage buckets delete "gs://$BUCKET_NAME"

    echo -e "   🪣 Step 3/4: Recreating bucket with original name in new location..."
    ensure_bucket_exists "$BUCKET_NAME" "$BUCKET_LOCATION" "$BUCKET_STORAGE_CLASS"
    wait_for_bucket_availability "$BUCKET_NAME"

    echo -e "   🔄 Step 4/4: Restoring data from temporary bucket to recreated original bucket..."
    gcloud storage rsync "gs://$BUCKET_MIGRATION_TEMP_NAME" "gs://$BUCKET_NAME" --recursive

    if [ "$DELETE_TEMP_BUCKET_AFTER_MIGRATION" = "true" ]; then
        echo -e "   🧹 Cleaning up temporary bucket: gs://$BUCKET_MIGRATION_TEMP_NAME"
        gcloud storage rm "gs://$BUCKET_MIGRATION_TEMP_NAME/**" --recursive || true
        gcloud storage buckets delete "gs://$BUCKET_MIGRATION_TEMP_NAME"
    else
        echo -e "   ℹ️  Keeping temporary bucket for verification: gs://$BUCKET_MIGRATION_TEMP_NAME"
    fi

    echo -e "   ✅ Strict same-name bucket migration completed."
}

split_csv() {
    local VALUE=$1
    printf '%s' "$VALUE" | tr '|' ',' | tr -s ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed '/^$/d'
}

prompt_value_if_empty() {
    local VAR_NAME=$1
    local LABEL=$2
    local DEFAULT_VALUE=${3:-}
    local SECRET_INPUT=${4:-false}
    local CURRENT_VALUE=${!VAR_NAME:-}
    local USER_INPUT=""

    if [ -n "$CURRENT_VALUE" ]; then
        return
    fi

    if [ "$SECRET_INPUT" = "true" ]; then
        read -r -s "?$LABEL${DEFAULT_VALUE:+ [$DEFAULT_VALUE]}: " USER_INPUT
        echo
    else
        read -r "?$LABEL${DEFAULT_VALUE:+ [$DEFAULT_VALUE]}: " USER_INPUT
    fi

    USER_INPUT="$(trim_value "$USER_INPUT")"
    if [ -z "$USER_INPUT" ]; then
        USER_INPUT="$DEFAULT_VALUE"
    fi

    printf -v "$VAR_NAME" '%s' "$USER_INPUT"
}

reuse_oidc_credentials_from_secret_manager() {
    if [ -z "$GOOGLE_OIDC_CLIENT_ID_VALUE" ] && gcloud secrets describe "$OIDC_CLIENT_ID_SECRET" &> /dev/null; then
        GOOGLE_OIDC_CLIENT_ID_VALUE=$(gcloud secrets versions access latest --secret="$OIDC_CLIENT_ID_SECRET" 2>/dev/null || true)
        GOOGLE_OIDC_CLIENT_ID_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_ID_VALUE")"
        if [ -n "$GOOGLE_OIDC_CLIENT_ID_VALUE" ]; then
            echo -e "   ✅ Reusing existing Google OIDC client ID from Secret Manager."
        fi
    fi

    if [ -z "$GOOGLE_OIDC_CLIENT_SECRET_VALUE" ] && gcloud secrets describe "$OIDC_CLIENT_SECRET_SECRET" &> /dev/null; then
        GOOGLE_OIDC_CLIENT_SECRET_VALUE=$(gcloud secrets versions access latest --secret="$OIDC_CLIENT_SECRET_SECRET" 2>/dev/null || true)
        GOOGLE_OIDC_CLIENT_SECRET_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_SECRET_VALUE")"
        if [ -n "$GOOGLE_OIDC_CLIENT_SECRET_VALUE" ]; then
            echo -e "   ✅ Reusing existing Google OIDC client secret from Secret Manager."
        fi
    fi
}

reuse_smtp_and_support_metadata_from_secret_manager() {
    if [ -z "$TECH_SUPPORT_TARGET_EMAIL" ] && gcloud secrets describe "$TECH_SUPPORT_TARGET_EMAIL_SECRET" &> /dev/null; then
        TECH_SUPPORT_TARGET_EMAIL=$(gcloud secrets versions access latest --secret="$TECH_SUPPORT_TARGET_EMAIL_SECRET" 2>/dev/null || true)
        TECH_SUPPORT_TARGET_EMAIL="$(trim_value "$TECH_SUPPORT_TARGET_EMAIL")"
        if [ -n "$TECH_SUPPORT_TARGET_EMAIL" ]; then
            echo -e "   ✅ Reusing existing support target email from Secret Manager."
        fi
    fi

    if [ -z "$SMTP_HOST_VALUE" ] && gcloud secrets describe "$SMTP_HOST_SECRET" &> /dev/null; then
        SMTP_HOST_VALUE=$(gcloud secrets versions access latest --secret="$SMTP_HOST_SECRET" 2>/dev/null || true)
        SMTP_HOST_VALUE="$(trim_value "$SMTP_HOST_VALUE")"
        if [ -n "$SMTP_HOST_VALUE" ]; then
            echo -e "   ✅ Reusing existing SMTP host from Secret Manager."
        fi
    fi

    if [ -z "$SMTP_USER_VALUE" ] && gcloud secrets describe "$SMTP_USER_SECRET" &> /dev/null; then
        SMTP_USER_VALUE=$(gcloud secrets versions access latest --secret="$SMTP_USER_SECRET" 2>/dev/null || true)
        SMTP_USER_VALUE="$(trim_value "$SMTP_USER_VALUE")"
        if [ -n "$SMTP_USER_VALUE" ]; then
            echo -e "   ✅ Reusing existing SMTP user from Secret Manager."
        fi
    fi

    if [ -z "$SMTP_FROM_EMAIL_VALUE" ] && gcloud secrets describe "$SMTP_FROM_EMAIL_SECRET" &> /dev/null; then
        SMTP_FROM_EMAIL_VALUE=$(gcloud secrets versions access latest --secret="$SMTP_FROM_EMAIL_SECRET" 2>/dev/null || true)
        SMTP_FROM_EMAIL_VALUE="$(trim_value "$SMTP_FROM_EMAIL_VALUE")"
        if [ -n "$SMTP_FROM_EMAIL_VALUE" ]; then
            echo -e "   ✅ Reusing existing SMTP from email from Secret Manager."
        fi
    fi

    if [ -z "$SMTP_FROM_NAME_VALUE" ] && gcloud secrets describe "$SMTP_FROM_NAME_SECRET" &> /dev/null; then
        SMTP_FROM_NAME_VALUE=$(gcloud secrets versions access latest --secret="$SMTP_FROM_NAME_SECRET" 2>/dev/null || true)
        SMTP_FROM_NAME_VALUE="$(trim_value "$SMTP_FROM_NAME_VALUE")"
        if [ -n "$SMTP_FROM_NAME_VALUE" ]; then
            echo -e "   ✅ Reusing existing SMTP from name from Secret Manager."
        fi
    fi
}

reuse_trusted_bff_secret_from_secret_manager() {
    if [ "$TRUSTED_BFF_AUTH_ENABLED" != "true" ]; then
        return
    fi

    if [ -z "$TRUSTED_BFF_SHARED_SECRET_VALUE" ] && gcloud secrets describe "$TRUSTED_BFF_SHARED_SECRET_SECRET" &> /dev/null; then
        TRUSTED_BFF_SHARED_SECRET_VALUE=$(gcloud secrets versions access latest --secret="$TRUSTED_BFF_SHARED_SECRET_SECRET" 2>/dev/null || true)
        TRUSTED_BFF_SHARED_SECRET_VALUE="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_VALUE")"
        if [ -n "$TRUSTED_BFF_SHARED_SECRET_VALUE" ]; then
            echo -e "   ✅ Reusing existing trusted BFF shared secret from Secret Manager."
        fi
    fi
}

generate_trusted_bff_secret_if_needed() {
    if [ "$TRUSTED_BFF_AUTH_ENABLED" != "true" ]; then
        return
    fi

    if [ -n "$TRUSTED_BFF_SHARED_SECRET_VALUE" ]; then
        return
    fi

    if command -v openssl >/dev/null 2>&1; then
        TRUSTED_BFF_SHARED_SECRET_VALUE="$(openssl rand -base64 48 | tr -d '\n')"
    else
        TRUSTED_BFF_SHARED_SECRET_VALUE="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
    fi

    TRUSTED_BFF_SHARED_SECRET_VALUE="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_VALUE")"

    if [ -z "$TRUSTED_BFF_SHARED_SECRET_VALUE" ]; then
        echo -e "${RED}❌ Failed to generate TRUSTED_BFF_SHARED_SECRET_VALUE automatically.${NC}"
        exit 1
    fi

    echo -e "   ✅ Generated a new trusted BFF shared secret automatically."
}

prompt_for_missing_config() {
    echo -e "${YELLOW}📝 Review SMTP/support config. Leave blank to use the shown default.${NC}"
    reuse_smtp_and_support_metadata_from_secret_manager
    prompt_value_if_empty TECH_SUPPORT_TARGET_EMAIL "Support target email" "support@example.com"
    prompt_value_if_empty SMTP_HOST_VALUE "SMTP host" "smtp.example.com"
    prompt_value_if_empty SMTP_PORT "SMTP port" "465"
    prompt_value_if_empty SMTP_SECURE "SMTP secure (true/false)" "true"
    prompt_value_if_empty SMTP_USER_VALUE "SMTP username/email" "no-reply@example.com"
    prompt_value_if_empty SMTP_FROM_EMAIL_VALUE "SMTP from email" "no-reply@example.com"
    prompt_value_if_empty SMTP_FROM_NAME_VALUE "SMTP from name" "AI FormCheck Support"
    reuse_oidc_credentials_from_secret_manager
    echo -e "${YELLOW}🪪 Review Google OIDC config. Callback URL defaults to the canonical Cloud Run URL if GOOGLE_OIDC_CALLBACK_URL is left unset.${NC}"
    prompt_value_if_empty GOOGLE_OIDC_CLIENT_ID_VALUE "Google OIDC client ID"
    prompt_value_if_empty GOOGLE_OIDC_CLIENT_SECRET_VALUE "Google OIDC client secret" "" true
    reuse_trusted_bff_secret_from_secret_manager
    if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ]; then
        echo -e "${YELLOW}🛡️  Trusted BFF auth is enabled. Backend will accept shared-secret-authenticated proxy requests from the frontend service.${NC}"
        generate_trusted_bff_secret_if_needed
    fi

    SMTP_HOST_VALUE="$(trim_value "$SMTP_HOST_VALUE")"
    SMTP_USER_VALUE="$(trim_value "$SMTP_USER_VALUE")"
    SMTP_FROM_EMAIL_VALUE="$(trim_value "$SMTP_FROM_EMAIL_VALUE")"
    SMTP_FROM_NAME_VALUE="$(trim_value "$SMTP_FROM_NAME_VALUE")"
    SMTP_PORT="$(trim_value "$SMTP_PORT")"
    SMTP_SECURE="$(trim_value "$SMTP_SECURE")"
    TECH_SUPPORT_TARGET_EMAIL="$(trim_value "$TECH_SUPPORT_TARGET_EMAIL")"
    GOOGLE_OIDC_CLIENT_ID_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_ID_VALUE")"
    GOOGLE_OIDC_CLIENT_SECRET_VALUE="$(trim_value "$GOOGLE_OIDC_CLIENT_SECRET_VALUE")"
    GOOGLE_OIDC_CALLBACK_URL="$(trim_value "$GOOGLE_OIDC_CALLBACK_URL")"
    TRUSTED_BFF_SHARED_SECRET_VALUE="$(trim_value "$TRUSTED_BFF_SHARED_SECRET_VALUE")"
}

ensure_smtp_password() {
    if [ -n "$SMTP_PASS_VALUE" ]; then
        return
    fi

    if gcloud secrets describe "$SMTP_PASS_SECRET" &> /dev/null; then
        SMTP_PASS_VALUE=$(gcloud secrets versions access latest --secret="$SMTP_PASS_SECRET" 2>/dev/null || true)
        if [ -n "$SMTP_PASS_VALUE" ]; then
            echo -e "   ✅ Reusing existing SMTP password from Secret Manager."
            return
        fi
    fi

    echo -e "${YELLOW}🔐 SMTP password not found in env or Secret Manager. Please enter it now.${NC}"
    read -s "SMTP_PASS_VALUE?SMTP Password: "
    echo

    if [ -z "$SMTP_PASS_VALUE" ]; then
        echo -e "${RED}❌ SMTP password is required.${NC}"
        exit 1
    fi
}

validate_smtp_config() {
    if ! validate_hostname "$SMTP_HOST_VALUE"; then
        echo -e "${RED}❌ Invalid SMTP_HOST_VALUE: $SMTP_HOST_VALUE${NC}"
        exit 1
    fi

    if ! [[ "$SMTP_PORT" =~ ^[0-9]+$ ]] || [ "$SMTP_PORT" -le 0 ] || [ "$SMTP_PORT" -gt 65535 ]; then
        echo -e "${RED}❌ Invalid SMTP_PORT: $SMTP_PORT${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$SMTP_SECURE"; then
        echo -e "${RED}❌ Invalid SMTP_SECURE: $SMTP_SECURE (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_email "$SMTP_USER_VALUE"; then
        echo -e "${RED}❌ Invalid SMTP_USER_VALUE: $SMTP_USER_VALUE${NC}"
        exit 1
    fi

    if ! validate_email "$SMTP_FROM_EMAIL_VALUE"; then
        echo -e "${RED}❌ Invalid SMTP_FROM_EMAIL_VALUE: $SMTP_FROM_EMAIL_VALUE${NC}"
        exit 1
    fi

    if ! validate_email "$TECH_SUPPORT_TARGET_EMAIL"; then
        echo -e "${RED}❌ Invalid TECH_SUPPORT_TARGET_EMAIL: $TECH_SUPPORT_TARGET_EMAIL${NC}"
        exit 1
    fi

    if ! validate_bucket_storage_class "$BUCKET_STORAGE_CLASS"; then
        echo -e "${RED}❌ Invalid BUCKET_STORAGE_CLASS: $BUCKET_STORAGE_CLASS${NC}"
        exit 1
    fi

    if [ -z "$FIRESTORE_DATABASE_ID" ]; then
        echo -e "${RED}❌ FIRESTORE_DATABASE_ID is required.${NC}"
        exit 1
    fi

    if [ -z "$FIRESTORE_LOCATION" ]; then
        echo -e "${RED}❌ FIRESTORE_LOCATION is required.${NC}"
        exit 1
    fi

    if ! validate_firestore_type "$FIRESTORE_TYPE"; then
        echo -e "${RED}❌ Invalid FIRESTORE_TYPE: $FIRESTORE_TYPE${NC}"
        exit 1
    fi

    if [ -z "$FIRESTORE_COLLECTION_NAME" ] || [ -z "$FIRESTORE_FILES_SUBCOLLECTION" ]; then
        echo -e "${RED}❌ Firestore collection config is incomplete.${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ENABLE_FIRESTORE_TTL_POLICIES"; then
        echo -e "${RED}❌ Invalid ENABLE_FIRESTORE_TTL_POLICIES: $ENABLE_FIRESTORE_TTL_POLICIES (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH"; then
        echo -e "${RED}❌ Invalid AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH: $AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ENABLE_BUCKET_LIFECYCLE_CLEANUP"; then
        echo -e "${RED}❌ Invalid ENABLE_BUCKET_LIFECYCLE_CLEANUP: $ENABLE_BUCKET_LIFECYCLE_CLEANUP (must be true or false)${NC}"
        exit 1
    fi

    if ! [[ "$BUCKET_DELETE_AFTER_DAYS" =~ ^[0-9]+$ ]] || [ "$BUCKET_DELETE_AFTER_DAYS" -le 0 ]; then
        echo -e "${RED}❌ Invalid BUCKET_DELETE_AFTER_DAYS: $BUCKET_DELETE_AFTER_DAYS${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ENABLE_DAILY_FILE_CLEANUP_FUNCTION"; then
        echo -e "${RED}❌ Invalid ENABLE_DAILY_FILE_CLEANUP_FUNCTION: $ENABLE_DAILY_FILE_CLEANUP_FUNCTION (must be true or false)${NC}"
        exit 1
    fi

    if [ "$ENABLE_DAILY_FILE_CLEANUP_FUNCTION" = "true" ]; then
        if [ -z "$CLEANUP_SERVICE_NAME" ] || [ -z "$CLEANUP_SERVICE_REGION" ] || [ -z "$CLEANUP_SCHEDULER_JOB_NAME" ] || [ -z "$CLEANUP_SCHEDULER_LOCATION" ] || [ -z "$CLEANUP_SCHEDULE_CRON" ] || [ -z "$CLEANUP_TIME_ZONE" ]; then
            echo -e "${RED}❌ Cleanup service config is incomplete.${NC}"
            exit 1
        fi
    fi

    if ! validate_boolean_string "$ENABLE_BUCKET_MIGRATION"; then
        echo -e "${RED}❌ Invalid ENABLE_BUCKET_MIGRATION: $ENABLE_BUCKET_MIGRATION (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$DELETE_SOURCE_BUCKET_AFTER_MIGRATION"; then
        echo -e "${RED}❌ Invalid DELETE_SOURCE_BUCKET_AFTER_MIGRATION: $DELETE_SOURCE_BUCKET_AFTER_MIGRATION (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION"; then
        echo -e "${RED}❌ Invalid ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION: $ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$DELETE_TEMP_BUCKET_AFTER_MIGRATION"; then
        echo -e "${RED}❌ Invalid DELETE_TEMP_BUCKET_AFTER_MIGRATION: $DELETE_TEMP_BUCKET_AFTER_MIGRATION (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET"; then
        echo -e "${RED}❌ Invalid AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET: $AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET (must be true or false)${NC}"
        exit 1
    fi

    if [ "$ENABLE_BUCKET_MIGRATION" = "true" ] && [ "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION" = "true" ]; then
        echo -e "${RED}❌ ENABLE_BUCKET_MIGRATION and ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION cannot both be true${NC}"
        exit 1
    fi

    if [ "$SMTP_PORT" = "465" ] && [ "$SMTP_SECURE" != "true" ]; then
        echo -e "${RED}❌ SMTP_PORT 465 must use SMTP_SECURE=true${NC}"
        exit 1
    fi

    if [ "$SMTP_PORT" = "587" ] && [ "$SMTP_SECURE" != "false" ]; then
        echo -e "${RED}❌ SMTP_PORT 587 should use SMTP_SECURE=false${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$OIDC_ENABLED"; then
        echo -e "${RED}❌ Invalid OIDC_ENABLED: $OIDC_ENABLED (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$OIDC_REQUIRE_HOSTED_DOMAIN"; then
        echo -e "${RED}❌ Invalid OIDC_REQUIRE_HOSTED_DOMAIN: $OIDC_REQUIRE_HOSTED_DOMAIN (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ALLOW_BEARER_SESSION_TOKEN"; then
        echo -e "${RED}❌ Invalid ALLOW_BEARER_SESSION_TOKEN: $ALLOW_BEARER_SESSION_TOKEN (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$TRUSTED_BFF_AUTH_ENABLED"; then
        echo -e "${RED}❌ Invalid TRUSTED_BFF_AUTH_ENABLED: $TRUSTED_BFF_AUTH_ENABLED (must be true or false)${NC}"
        exit 1
    fi

    if [ -z "$TRUSTED_BFF_AUTH_HEADER_NAME" ]; then
        echo -e "${RED}❌ TRUSTED_BFF_AUTH_HEADER_NAME is required.${NC}"
        exit 1
    fi

    if ! validate_ingress_setting "$CLOUD_RUN_INGRESS"; then
        echo -e "${RED}❌ Invalid CLOUD_RUN_INGRESS: $CLOUD_RUN_INGRESS${NC}"
        exit 1
    fi

    if ! validate_cloud_run_auth_mode "$CLOUD_RUN_AUTH_MODE"; then
        echo -e "${RED}❌ Invalid CLOUD_RUN_AUTH_MODE: $CLOUD_RUN_AUTH_MODE (must be public or private)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$TRUST_PROXY_BROWSER_ORIGIN_HEADER"; then
        echo -e "${RED}❌ Invalid TRUST_PROXY_BROWSER_ORIGIN_HEADER: $TRUST_PROXY_BROWSER_ORIGIN_HEADER (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_cookie_same_site "$COOKIE_SAME_SITE"; then
        echo -e "${RED}❌ Invalid COOKIE_SAME_SITE: $COOKIE_SAME_SITE (must be Strict, Lax, or None)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$COOKIE_SECURE"; then
        echo -e "${RED}❌ Invalid COOKIE_SECURE: $COOKIE_SECURE (must be true or false)${NC}"
        exit 1
    fi

    if [ -z "$TRUST_PROXY" ]; then
        echo -e "${RED}❌ TRUST_PROXY is required.${NC}"
        exit 1
    fi

    if [ -z "$BROWSER_ORIGIN_HEADER_NAME" ]; then
        echo -e "${RED}❌ BROWSER_ORIGIN_HEADER_NAME is required.${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$POST_DEPLOY_HEALTHCHECK_ENABLED"; then
        echo -e "${RED}❌ Invalid POST_DEPLOY_HEALTHCHECK_ENABLED: $POST_DEPLOY_HEALTHCHECK_ENABLED (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$SKIP_PROJECT_IAM_BINDINGS"; then
        echo -e "${RED}❌ Invalid SKIP_PROJECT_IAM_BINDINGS: $SKIP_PROJECT_IAM_BINDINGS (must be true or false)${NC}"
        exit 1
    fi

    if ! [[ "$AI_DAILY_TOKEN_LIMIT" =~ ^[0-9]+$ ]] || [ "$AI_DAILY_TOKEN_LIMIT" -le 0 ]; then
        echo -e "${RED}❌ Invalid AI_DAILY_TOKEN_LIMIT: $AI_DAILY_TOKEN_LIMIT${NC}"
        exit 1
    fi

    if ! [[ "$AI_USAGE_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [ "$AI_USAGE_RETENTION_DAYS" -le 0 ]; then
        echo -e "${RED}❌ Invalid AI_USAGE_RETENTION_DAYS: $AI_USAGE_RETENTION_DAYS${NC}"
        exit 1
    fi

    if [ "$OIDC_ENABLED" = "true" ]; then
        if [ -z "$GOOGLE_OIDC_CLIENT_ID_VALUE" ]; then
            echo -e "${RED}❌ GOOGLE_OIDC_CLIENT_ID_VALUE is required when OIDC_ENABLED=true${NC}"
            exit 1
        fi

        if [ -z "$GOOGLE_OIDC_CLIENT_SECRET_VALUE" ]; then
            echo -e "${RED}❌ GOOGLE_OIDC_CLIENT_SECRET_VALUE is required when OIDC_ENABLED=true${NC}"
            exit 1
        fi
    fi

    if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ] && [ -z "$TRUSTED_BFF_SHARED_SECRET_VALUE" ]; then
        echo -e "${RED}❌ TRUSTED_BFF_SHARED_SECRET_VALUE is required when TRUSTED_BFF_AUTH_ENABLED=true${NC}"
        exit 1
    fi
}

resolve_deploy_mode_settings() {
    CLOUD_RUN_INGRESS="${CLOUD_RUN_INGRESS:-all}"
    if [ "$CLOUD_RUN_AUTH_MODE" = "private" ]; then
        RUN_AUTH_FLAG="--no-allow-unauthenticated"
    else
        RUN_AUTH_FLAG="--allow-unauthenticated"
    fi
    DEFAULT_URL_FLAG="--default-url"
}

print_deploy_summary() {
    echo -e "${YELLOW}📋 Deployment configuration summary${NC}"
    echo -e "   Project ID              : ${YELLOW}$PROJECT_ID${NC}"
    echo -e "   App Name                : ${YELLOW}$APP_NAME${NC}"
    echo -e "   Service Name            : ${YELLOW}$SERVICE_NAME${NC}"
    echo -e "   Frontend Service Name   : ${YELLOW}$FRONTEND_SERVICE_NAME${NC}"
    echo -e "   Frontend Service Account: ${YELLOW}$FRONTEND_SERVICE_ACCOUNT_EMAIL${NC}"
    echo -e "   Frontend Invoker Override: ${YELLOW}${FRONTEND_INVOKER_SERVICE_ACCOUNT:-<derived from name>}${NC}"
    echo -e "   Bucket                  : ${YELLOW}$BUCKET_NAME${NC}"
    echo -e "   Bucket Location         : ${YELLOW}$BUCKET_LOCATION${NC}"
    echo -e "   Bucket Storage Class    : ${YELLOW}$BUCKET_STORAGE_CLASS${NC}"
    echo -e "   Firestore Database ID   : ${YELLOW}$FIRESTORE_DATABASE_ID${NC}"
    echo -e "   Firestore Location      : ${YELLOW}$FIRESTORE_LOCATION${NC}"
    echo -e "   Firestore Type          : ${YELLOW}$FIRESTORE_TYPE${NC}"
    echo -e "   Firestore Session Coll  : ${YELLOW}$FIRESTORE_COLLECTION_NAME${NC}"
    echo -e "   Firestore Files Subcoll : ${YELLOW}$FIRESTORE_FILES_SUBCOLLECTION${NC}"
    echo -e "   Firestore TTL Enabled   : ${YELLOW}$ENABLE_FIRESTORE_TTL_POLICIES${NC}"
    echo -e "   Auto Bucket Recreate    : ${YELLOW}$AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH${NC}"
    echo -e "   Bucket Cleanup Enabled  : ${YELLOW}$ENABLE_BUCKET_LIFECYCLE_CLEANUP${NC}"
    echo -e "   Bucket Delete After Days: ${YELLOW}$BUCKET_DELETE_AFTER_DAYS${NC}"
    echo -e "   Bucket Lifecycle File   : ${YELLOW}$BUCKET_LIFECYCLE_FILE${NC}"
    echo -e "   Daily Cleanup Enabled   : ${YELLOW}$ENABLE_DAILY_FILE_CLEANUP_FUNCTION${NC}"
    echo -e "   Cleanup Service Name    : ${YELLOW}$CLEANUP_SERVICE_NAME${NC}"
    echo -e "   Cleanup Service Region  : ${YELLOW}$CLEANUP_SERVICE_REGION${NC}"
    echo -e "   Cleanup Service Account : ${YELLOW}${CLEANUP_SERVICE_ACCOUNT_EMAIL:-<pending>}${NC}"
    echo -e "   Cleanup Invoker         : ${YELLOW}${CLEANUP_INVOKER_SERVICE_ACCOUNT:-<cleanup service account>}${NC}"
    echo -e "   Cleanup Scheduler Job   : ${YELLOW}$CLEANUP_SCHEDULER_JOB_NAME${NC}"
    echo -e "   Cleanup Scheduler Loc   : ${YELLOW}$CLEANUP_SCHEDULER_LOCATION${NC}"
    echo -e "   Cleanup Scheduler Fallback: ${YELLOW}$CLEANUP_SCHEDULER_FALLBACK_LOCATION${NC}"
    echo -e "   Cleanup Schedule        : ${YELLOW}$CLEANUP_SCHEDULE_CRON${NC}"
    echo -e "   Cleanup Time Zone       : ${YELLOW}$CLEANUP_TIME_ZONE${NC}"
    echo -e "   Bucket Migration        : ${YELLOW}$ENABLE_BUCKET_MIGRATION${NC}"
    echo -e "   Bucket Source           : ${YELLOW}${BUCKET_MIGRATION_SOURCE_NAME:-<not set>}${NC}"
    echo -e "   Delete Source Bucket    : ${YELLOW}$DELETE_SOURCE_BUCKET_AFTER_MIGRATION${NC}"
    echo -e "   Strict Same-Name Move   : ${YELLOW}$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION${NC}"
    echo -e "   Temp Bucket             : ${YELLOW}${BUCKET_MIGRATION_TEMP_NAME:-<not set>}${NC}"
    echo -e "   Delete Temp Bucket      : ${YELLOW}$DELETE_TEMP_BUCKET_AFTER_MIGRATION${NC}"
    echo -e "   Cleanup Leftover Temp   : ${YELLOW}$AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET${NC}"
    echo -e "   Auto Bucket Triggered   : ${YELLOW}${AUTO_BUCKET_MIGRATION_TRIGGERED:-false}${NC}"
    echo -e "   Frontend URL(s)         : ${YELLOW}$FRONTEND_URL${NC}"
    echo -e "   Support Target Email    : ${YELLOW}$TECH_SUPPORT_TARGET_EMAIL${NC}"
    echo -e "   SMTP Host               : ${YELLOW}$SMTP_HOST_VALUE${NC}"
    echo -e "   SMTP Port               : ${YELLOW}$SMTP_PORT${NC}"
    echo -e "   SMTP Secure             : ${YELLOW}$SMTP_SECURE${NC}"
    echo -e "   SMTP User               : ${YELLOW}$SMTP_USER_VALUE${NC}"
    echo -e "   SMTP From Email         : ${YELLOW}$SMTP_FROM_EMAIL_VALUE${NC}"
    echo -e "   SMTP From Name          : ${YELLOW}$SMTP_FROM_NAME_VALUE${NC}"
    echo -e "   Node Env                : ${YELLOW}$NODE_ENV${NC}"
    echo -e "   AI Daily Token Limit    : ${YELLOW}$AI_DAILY_TOKEN_LIMIT${NC}"
    echo -e "   AI Usage Retention Days : ${YELLOW}$AI_USAGE_RETENTION_DAYS${NC}"
    echo -e "   OIDC Enabled            : ${YELLOW}$OIDC_ENABLED${NC}"
    echo -e "   OIDC Allowed Domains    : ${YELLOW}$OIDC_ALLOWED_DOMAINS${NC}"
    echo -e "   OIDC Require HD         : ${YELLOW}$OIDC_REQUIRE_HOSTED_DOMAIN${NC}"
    echo -e "   Bearer Session Fallback : ${YELLOW}$ALLOW_BEARER_SESSION_TOKEN${NC}"
    echo -e "   Trusted BFF Auth        : ${YELLOW}$TRUSTED_BFF_AUTH_ENABLED${NC}"
    echo -e "   Trusted BFF Header      : ${YELLOW}$TRUSTED_BFF_AUTH_HEADER_NAME${NC}"
    echo -e "   Trusted BFF Secret      : ${YELLOW}$TRUSTED_BFF_SHARED_SECRET_SECRET${NC}"
    echo -e "   Canonical run.app URL   : ${YELLOW}${CANONICAL_RUN_APP_BASE_URL}${NC}"
    echo -e "   Canonical frontend URL  : ${YELLOW}${CANONICAL_FRONTEND_RUN_APP_BASE_URL}${NC}"
    echo -e "   OIDC Callback URL       : ${YELLOW}${GOOGLE_OIDC_CALLBACK_URL}${NC}"
    echo -e "   Public Entry Point      : ${YELLOW}Cloud Run run.app${NC}"
    echo -e "   OIDC Client ID Secret   : ${YELLOW}$OIDC_CLIENT_ID_SECRET${NC}"
    echo -e "   OIDC Client Secret      : ${YELLOW}$OIDC_CLIENT_SECRET_SECRET${NC}"
    echo -e "   Cloud Run Ingress       : ${YELLOW}$CLOUD_RUN_INGRESS${NC}"
    echo -e "   Cloud Run Auth Mode     : ${YELLOW}$CLOUD_RUN_AUTH_MODE${NC}"
    echo -e "   Trust Proxy             : ${YELLOW}$TRUST_PROXY${NC}"
    echo -e "   Cookie SameSite         : ${YELLOW}$COOKIE_SAME_SITE${NC}"
    echo -e "   Cookie Secure           : ${YELLOW}$COOKIE_SECURE${NC}"
    echo -e "   Run Auth Flag           : ${YELLOW}$RUN_AUTH_FLAG${NC}"
    echo -e "   Default URL Flag        : ${YELLOW}${DEFAULT_URL_FLAG:-<auto>}${NC}"
    echo -e "   App Service Account     : ${YELLOW}${APP_SERVICE_ACCOUNT_EMAIL:-<pending>}${NC}"
    echo -e "   Trust Proxy Origin Hdr  : ${YELLOW}$TRUST_PROXY_BROWSER_ORIGIN_HEADER${NC}"
    echo -e "   Browser Origin Header   : ${YELLOW}$BROWSER_ORIGIN_HEADER_NAME${NC}"
    echo -e "   Post Deploy Healthcheck : ${YELLOW}$POST_DEPLOY_HEALTHCHECK_ENABLED${NC}"
    echo -e "   Skip Project IAM Bindings: ${YELLOW}$SKIP_PROJECT_IAM_BINDINGS${NC}"

    if [ "${AUTO_BUCKET_MIGRATION_TRIGGERED:-false}" = "true" ]; then
        echo -e "${RED}⚠️  AUTO BUCKET MIGRATION WILL RUN IN THIS DEPLOY${NC}"
        echo -e "${RED}⚠️  Bucket Name            : $BUCKET_NAME${NC}"
        echo -e "${RED}⚠️  Current Location       : ${EXISTING_BUCKET_LOCATION:-unknown}${NC}"
        echo -e "${RED}⚠️  Target Location        : $BUCKET_LOCATION${NC}"
        echo -e "${RED}⚠️  Temp Bucket            : $BUCKET_MIGRATION_TEMP_NAME${NC}"
        echo -e "${RED}⚠️  This path causes downtime while the original bucket is deleted and recreated.${NC}"
    fi
}

run_preflight_checks() {
    echo -e "${YELLOW}🧪 Running deploy preflight checks...${NC}"

    local PRECHECK_FAILED="false"

    if [ "$GOOGLE_OIDC_CALLBACK_URL" != "${CANONICAL_RUN_APP_BASE_URL}/api/v1/oidc/google/callback" ]; then
        echo -e "${YELLOW}   ⚠️  GOOGLE_OIDC_CALLBACK_URL differs from the canonical run.app callback.${NC}"
        echo -e "   Expected canonical callback: ${YELLOW}${CANONICAL_RUN_APP_BASE_URL}/api/v1/oidc/google/callback${NC}"
        echo -e "   Current callback           : ${YELLOW}${GOOGLE_OIDC_CALLBACK_URL}${NC}"
        echo -e "   ℹ️  This is allowed only if your Google OAuth provider is configured with this exact redirect URI."
    else
        echo -e "   ✅ OIDC callback matches canonical run.app URL."
    fi

    if ! printf '%s' "$GOOGLE_OIDC_CALLBACK_URL" | grep -Eq '^https://[^[:space:]]+/api/v1/oidc/google/callback$'; then
        echo -e "${RED}   ❌ GOOGLE_OIDC_CALLBACK_URL must be an HTTPS callback ending with /api/v1/oidc/google/callback${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$TRUST_PROXY_BROWSER_ORIGIN_HEADER" = "true" ] && [ "$CLOUD_RUN_AUTH_MODE" != "private" ]; then
        echo -e "${RED}   ❌ TRUST_PROXY_BROWSER_ORIGIN_HEADER=true requires CLOUD_RUN_AUTH_MODE=private${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_BEARER_SESSION_TOKEN" = "true" ]; then
        echo -e "${RED}   ❌ ALLOW_BEARER_SESSION_TOKEN=true is not allowed in production.${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$(printf '%s' "$COOKIE_SAME_SITE" | tr '[:upper:]' '[:lower:]')" = "none" ] && [ "$COOKIE_SECURE" != "true" ]; then
        echo -e "${RED}   ❌ COOKIE_SAME_SITE=None requires COOKIE_SECURE=true${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$CLOUD_RUN_AUTH_MODE" = "private" ] && [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ] && [ "$(printf '%s' "$COOKIE_SAME_SITE" | tr '[:upper:]' '[:lower:]')" = "none" ]; then
        echo -e "${YELLOW}   ⚠️  COOKIE_SAME_SITE=None is unusual for private BFF mode. Prefer Lax unless browser must send backend cookies cross-site.${NC}"
    fi

    if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ] && [ "$CLOUD_RUN_AUTH_MODE" != "private" ]; then
        echo -e "${RED}   ❌ TRUSTED_BFF_AUTH_ENABLED=true requires CLOUD_RUN_AUTH_MODE=private${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$CLOUD_RUN_AUTH_MODE" = "private" ] && ! validate_email "$FRONTEND_SERVICE_ACCOUNT_EMAIL"; then
        echo -e "${RED}   ❌ FRONTEND_SERVICE_ACCOUNT_EMAIL is invalid for private backend mode: ${FRONTEND_SERVICE_ACCOUNT_EMAIL}${NC}"
        PRECHECK_FAILED="true"
    fi

    if [ "$PRECHECK_FAILED" = "true" ]; then
        echo -e "${RED}❌ Preflight checks failed. Fix the configuration before deploy.${NC}"
        exit 1
    fi
}

resource_exists() {
    "$@" &> /dev/null
}

normalize_csv_values() {
    local RAW_VALUES=$1
    printf '%s' "$RAW_VALUES" \
        | tr ',' '\n' \
        | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
        | tr '[:upper:]' '[:lower:]' \
        | grep -v '^$' \
        | sort \
        | paste -sd ',' -
}

ensure_global_address() {
    echo -e "   ℹ️  HTTPS Load Balancer automation is not part of the OIDC + run.app deploy path."
}

delete_legacy_cleanup_scheduler_job_if_exists() {
    local JOB_NAME=$1
    local JOB_LOCATION=$2

    if [ -z "$JOB_NAME" ] || [ -z "$JOB_LOCATION" ]; then
        return
    fi

    if gcloud scheduler jobs describe "$JOB_NAME" --location "$JOB_LOCATION" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "   🧹 Deleting legacy scheduler job: ${YELLOW}$JOB_NAME${NC} (${JOB_LOCATION})"
        gcloud scheduler jobs delete "$JOB_NAME" \
            --location "$JOB_LOCATION" \
            --project "$PROJECT_ID" \
            --quiet
    fi
}

delete_legacy_cleanup_function_if_exists() {
    local FUNCTION_NAME=$1
    local FUNCTION_REGION=$2

    if [ -z "$FUNCTION_NAME" ] || [ -z "$FUNCTION_REGION" ]; then
        return
    fi

    if gcloud functions describe "$FUNCTION_NAME" --gen2 --region "$FUNCTION_REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo -e "   🧹 Deleting legacy cleanup function: ${YELLOW}$FUNCTION_NAME${NC} (${FUNCTION_REGION})"
        gcloud functions delete "$FUNCTION_NAME" \
            --gen2 \
            --region "$FUNCTION_REGION" \
            --project "$PROJECT_ID" \
            --quiet
    fi
}

cleanup_legacy_cleanup_resources() {
    echo -e "${YELLOW}🧽 Cleaning up legacy cleanup resources...${NC}"

    delete_legacy_cleanup_scheduler_job_if_exists "delete-file-daily" "asia-southeast1"
    delete_legacy_cleanup_scheduler_job_if_exists "delete-file-fn-daily" "asia-southeast1"
    delete_legacy_cleanup_scheduler_job_if_exists "delete-file-daily" "$CLEANUP_SCHEDULER_LOCATION"
    delete_legacy_cleanup_scheduler_job_if_exists "delete-file-fn-daily" "$CLEANUP_SCHEDULER_LOCATION"

    delete_legacy_cleanup_function_if_exists "delete-file" "asia-southeast1"
    delete_legacy_cleanup_function_if_exists "delete-file-fn" "asia-southeast1"
    delete_legacy_cleanup_function_if_exists "delete-file" "$CLEANUP_SERVICE_REGION"
    delete_legacy_cleanup_function_if_exists "delete-file-fn" "$CLEANUP_SERVICE_REGION"

    echo -e "   ✅ Legacy cleanup resource cleanup complete."
}

run_post_deploy_healthcheck() {
    if [ "$POST_DEPLOY_HEALTHCHECK_ENABLED" != "true" ]; then
        echo -e "   ℹ️  Skipping post-deploy healthcheck because POST_DEPLOY_HEALTHCHECK_ENABLED=false"
        return
    fi

    local PRIMARY_DOMAIN=""

    PRIMARY_DOMAIN="$(gcloud run services describe "$SERVICE_NAME" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format='value(status.url)' 2>/dev/null | sed 's#^https\?://##' | sed 's#/.*$##')"

    if [ -z "$PRIMARY_DOMAIN" ]; then
        echo -e "   ℹ️  No domain available for post-deploy healthcheck"
        return
    fi

    local HEALTH_URL="https://${PRIMARY_DOMAIN}${POST_DEPLOY_HEALTHCHECK_PATH}"
    echo -e "   🩺 Running healthcheck: ${YELLOW}${HEALTH_URL}${NC}"

    local HTTP_CODE
    HTTP_CODE=$(curl -ksS -o /tmp/codex_iap_healthcheck_body.txt -w '%{http_code}' "$HEALTH_URL" || true)
    local BODY
    BODY=$(cat /tmp/codex_iap_healthcheck_body.txt 2>/dev/null || true)

    echo -e "   🔎 Healthcheck HTTP status: ${YELLOW}${HTTP_CODE:-<none>}${NC}"
    if [ -n "$BODY" ]; then
        echo -e "   🔎 Healthcheck body: ${YELLOW}${BODY}${NC}"
    fi

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        echo -e "   ✅ HTTPS endpoint is responding."
    else
        echo -e "   ⚠️  HTTPS endpoint did not return an expected status yet."
        return
    fi

    if [ "$CLOUD_RUN_AUTH_MODE" = "private" ]; then
        echo -e "   ℹ️  Skipping signed URL smoke check because CLOUD_RUN_AUTH_MODE=private requires an authenticated caller."
        return
    fi

    local SIGNING_URL="https://${PRIMARY_DOMAIN}/api/v1/system/status/storage-signing"
    echo -e "   🔐 Running signed URL smoke check: ${YELLOW}${SIGNING_URL}${NC}"

    local SIGNING_HTTP_CODE
    SIGNING_HTTP_CODE=$(curl -ksS -o /tmp/codex_signed_url_probe_body.txt -w '%{http_code}' "$SIGNING_URL" || true)
    local SIGNING_BODY
    SIGNING_BODY=$(cat /tmp/codex_signed_url_probe_body.txt 2>/dev/null || true)

    echo -e "   🔎 Signed URL smoke check HTTP status: ${YELLOW}${SIGNING_HTTP_CODE:-<none>}${NC}"
    if [ -n "$SIGNING_BODY" ]; then
        echo -e "   🔎 Signed URL smoke check body: ${YELLOW}${SIGNING_BODY}${NC}"
    fi

    if [ "$SIGNING_HTTP_CODE" = "200" ]; then
        echo -e "   ✅ Signed URL generation capability is responding."
        return
    fi

    echo -e "   ⚠️  Signed URL smoke check failed. Merge flow may fail when generating download URLs."
}

# 4. สร้าง/ตรวจ Bucket
echo -e "${YELLOW}📦 Checking Cloud Storage Bucket...${NC}"
if gcloud storage buckets describe "gs://$BUCKET_NAME" &> /dev/null; then
    print_existing_bucket_metadata "$BUCKET_NAME"
    auto_prepare_bucket_migration_if_needed
fi

if [ "$ENABLE_STRICT_SAME_NAME_BUCKET_MIGRATION" = "true" ]; then
    migrate_bucket_same_name_if_requested
    print_existing_bucket_metadata "$BUCKET_NAME"
elif [ "$ENABLE_BUCKET_MIGRATION" = "true" ]; then
    migrate_bucket_if_requested
    print_existing_bucket_metadata "$BUCKET_NAME"
elif ! gcloud storage buckets describe "gs://$BUCKET_NAME" &> /dev/null; then
    ensure_bucket_exists "$BUCKET_NAME" "$BUCKET_LOCATION" "$BUCKET_STORAGE_CLASS"
else
    echo -e "   ✅ Bucket exists."
    print_existing_bucket_metadata "$BUCKET_NAME"
fi
handle_leftover_temp_bucket_if_needed
ensure_bucket_lifecycle_policy
ensure_firestore_database
ensure_firestore_ttl_policies

# 5. จัดการ Secrets และ Keys
echo -e "${YELLOW}🔐 Managing Secrets & Keys...${NC}"

prompt_for_missing_config
validate_smtp_config
ensure_smtp_password
resolve_deploy_mode_settings
run_preflight_checks
print_deploy_summary

# 5.1 JWT Secret (สุ่มใหม่ถ้าไม่มี)
RANDOM_JWT=$(openssl rand -base64 32)
create_secret_if_missing $SECRET_NAME "$RANDOM_JWT"

# 5.2 DB Encryption Key (สุ่ม Hex 32 bytes)
RANDOM_DB_KEY=$(openssl rand -hex 32)
create_secret_if_missing $DB_KEY_SECRET "$RANDOM_DB_KEY"

# 5.3 SMTP Secrets (สร้างหรืออัปเดตให้ตรงกับค่าปัจจุบัน)
upsert_secret_value $SMTP_HOST_SECRET "$SMTP_HOST_VALUE"
upsert_secret_value $SMTP_USER_SECRET "$SMTP_USER_VALUE"
upsert_secret_value $SMTP_PASS_SECRET "$SMTP_PASS_VALUE"
upsert_secret_value $SMTP_FROM_EMAIL_SECRET "$SMTP_FROM_EMAIL_VALUE"
upsert_secret_value $SMTP_FROM_NAME_SECRET "$SMTP_FROM_NAME_VALUE"
upsert_secret_value $TECH_SUPPORT_TARGET_EMAIL_SECRET "$TECH_SUPPORT_TARGET_EMAIL"
upsert_secret_value $OIDC_CLIENT_ID_SECRET "$GOOGLE_OIDC_CLIENT_ID_VALUE"
upsert_secret_value $OIDC_CLIENT_SECRET_SECRET "$GOOGLE_OIDC_CLIENT_SECRET_VALUE"
if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ]; then
    upsert_secret_value $TRUSTED_BFF_SHARED_SECRET_SECRET "$TRUSTED_BFF_SHARED_SECRET_VALUE"
fi


if ! gcloud secrets describe $PRIV_KEY_SECRET &> /dev/null; then
    echo -e "   ⚙️  Generating NEW RSA Key Pair..."

    TMP_PRIVATE_KEY_FILE=$(mktemp /tmp/sci-request-private-key.XXXXXX.pem)
    TMP_PUBLIC_KEY_FILE=$(mktemp /tmp/sci-request-public-key.XXXXXX.pem)

    openssl genpkey -algorithm RSA -out "$TMP_PRIVATE_KEY_FILE" -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in "$TMP_PRIVATE_KEY_FILE" -out "$TMP_PUBLIC_KEY_FILE"

    PRIV_B64=$(base64 < "$TMP_PRIVATE_KEY_FILE" | tr -d '\n')
    PUB_B64=$(base64 < "$TMP_PUBLIC_KEY_FILE" | tr -d '\n')

    create_secret_if_missing $PRIV_KEY_SECRET "$PRIV_B64"
    create_secret_if_missing $PUB_KEY_SECRET "$PUB_B64"

    rm -f "$TMP_PRIVATE_KEY_FILE" "$TMP_PUBLIC_KEY_FILE"
else
    echo -e "   ✅ RSA Keys already exist."
fi

# 6. ตั้งค่า IAM (สิทธิ์การเข้าถึง)
echo -e "${YELLOW}👮 Configuring Service Account Permissions...${NC}"
SERVICE_ACCOUNT="$APP_SERVICE_ACCOUNT_EMAIL"

echo -e "   Service Account: $SERVICE_ACCOUNT"
ensure_app_service_account_and_permissions

echo -e "   ✅ Permissions granted."

ensure_daily_cleanup_function_and_scheduler

# 7. Deploy to Cloud Run
echo -e "${GREEN}🚀 Deploying to Cloud Run...${NC}"

DEPLOY_SET_SECRET_ARGS=(
  --set-secrets "JWT_SECRET=${SECRET_NAME}:latest"
  --set-secrets "Gb_PRIVATE_KEY_BASE64=${PRIV_KEY_SECRET}:latest"
  --set-secrets "Gb_PUBLIC_KEY_BASE64=${PUB_KEY_SECRET}:latest"
  --set-secrets "DB_ENCRYPTION_KEY=${DB_KEY_SECRET}:latest"
  --set-secrets "SMTP_HOST=${SMTP_HOST_SECRET}:latest"
  --set-secrets "SMTP_USER=${SMTP_USER_SECRET}:latest"
  --set-secrets "SMTP_PASS=${SMTP_PASS_SECRET}:latest"
  --set-secrets "SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL_SECRET}:latest"
  --set-secrets "SMTP_FROM_NAME=${SMTP_FROM_NAME_SECRET}:latest"
  --set-secrets "GOOGLE_OIDC_CLIENT_ID=${OIDC_CLIENT_ID_SECRET}:latest"
  --set-secrets "GOOGLE_OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET_SECRET}:latest"
)

if [ "$TRUSTED_BFF_AUTH_ENABLED" = "true" ]; then
    DEPLOY_SET_SECRET_ARGS+=(
      --set-secrets "TRUSTED_BFF_SHARED_SECRET=${TRUSTED_BFF_SHARED_SECRET_SECRET}:latest"
    )
fi

if gcloud secrets describe "$PREV_PRIV_KEY_SECRET" &> /dev/null && gcloud secrets describe "$PREV_PUB_KEY_SECRET" &> /dev/null; then
    echo -e "   🔄 Attaching previous key pair secrets for rotation fallback."
    DEPLOY_SET_SECRET_ARGS+=(
      --set-secrets "Gb_PREVIOUS_PRIVATE_KEY_BASE64=${PREV_PRIV_KEY_SECRET}:latest"
      --set-secrets "Gb_PREVIOUS_PUBLIC_KEY_BASE64=${PREV_PUB_KEY_SECRET}:latest"
    )
else
    echo -e "   ℹ️  Previous key pair secrets not found. Deploying with active key pair only."
fi

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --source "$SCRIPT_DIR" \
  --region "$REGION" \
  --ingress "$CLOUD_RUN_INGRESS" \
  "$RUN_AUTH_FLAG" \
  "$DEFAULT_URL_FLAG" \
  --service-account "$APP_SERVICE_ACCOUNT_EMAIL" \
  --set-env-vars "^__ENV_DELIM__^NODE_ENV=${NODE_ENV}__ENV_DELIM__GCP_PROJECT_ID=${PROJECT_ID}__ENV_DELIM__GCP_PROJECT_NUMBER=${PROJECT_NUMBER}__ENV_DELIM__GCS_BUCKET_NAME=${BUCKET_NAME}__ENV_DELIM__FIRESTORE_DATABASE_ID=${FIRESTORE_DATABASE_ID}__ENV_DELIM__FIRESTORE_COLLECTION_NAME=${FIRESTORE_COLLECTION_NAME}__ENV_DELIM__FIRESTORE_FILES_SUBCOLLECTION=${FIRESTORE_FILES_SUBCOLLECTION}__ENV_DELIM__APP_REGION=${REGION}__ENV_DELIM__AI_LOCATION=${AI_LOCATION}__ENV_DELIM__AI_DAILY_TOKEN_LIMIT=${AI_DAILY_TOKEN_LIMIT}__ENV_DELIM__AI_USAGE_RETENTION_DAYS=${AI_USAGE_RETENTION_DAYS}__ENV_DELIM__GCP_LOCATION=${AI_LOCATION}__ENV_DELIM__FRONTEND_URL=${FRONTEND_URL}__ENV_DELIM__TECH_SUPPORT_TARGET_EMAIL=${TECH_SUPPORT_TARGET_EMAIL}__ENV_DELIM__SMTP_PORT=${SMTP_PORT}__ENV_DELIM__SMTP_SECURE=${SMTP_SECURE}__ENV_DELIM__OIDC_ENABLED=${OIDC_ENABLED}__ENV_DELIM__OIDC_ALLOWED_DOMAINS=${OIDC_ALLOWED_DOMAINS}__ENV_DELIM__OIDC_REQUIRE_HOSTED_DOMAIN=${OIDC_REQUIRE_HOSTED_DOMAIN}__ENV_DELIM__ALLOW_BEARER_SESSION_TOKEN=${ALLOW_BEARER_SESSION_TOKEN}__ENV_DELIM__GOOGLE_OIDC_CALLBACK_URL=${GOOGLE_OIDC_CALLBACK_URL}__ENV_DELIM__TRUST_PROXY=${TRUST_PROXY}__ENV_DELIM__COOKIE_SAME_SITE=${COOKIE_SAME_SITE}__ENV_DELIM__COOKIE_SECURE=${COOKIE_SECURE}__ENV_DELIM__TRUST_PROXY_BROWSER_ORIGIN_HEADER=${TRUST_PROXY_BROWSER_ORIGIN_HEADER}__ENV_DELIM__BROWSER_ORIGIN_HEADER_NAME=${BROWSER_ORIGIN_HEADER_NAME}__ENV_DELIM__TRUSTED_BFF_AUTH_ENABLED=${TRUSTED_BFF_AUTH_ENABLED}__ENV_DELIM__TRUSTED_BFF_AUTH_HEADER_NAME=${TRUSTED_BFF_AUTH_HEADER_NAME}" \
  "${DEPLOY_SET_SECRET_ARGS[@]}"

if [ $? -eq 0 ]; then
  grant_backend_service_invoker_binding_if_needed
  echo -e "${GREEN}--------------------------------------------------${NC}"
  echo -e "${GREEN}✅ Deployment Successful!${NC}"
  echo -e "${GREEN}--------------------------------------------------${NC}"
else
  echo -e "${RED}--------------------------------------------------${NC}"
  echo -e "${RED}❌ Deployment Failed!${NC}"
  exit 1
fi

run_post_deploy_healthcheck
echo -e "   ℹ️  Domain mapping / HTTPS Load Balancer automation is handled outside deploy.sh in this OIDC + run.app mode."
