#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
# แก้ค่าได้ 2 วิธี:
# 1) แก้ default ในไฟล์นี้โดยตรง
# 2) ส่ง env ตอนรัน เช่น SMTP_HOST_VALUE=mail.example.com ./deploy.sh
PROJECT_ID="${PROJECT_ID:-seniorproject101}"
SERVICE_NAME="${SERVICE_NAME:-sci-request-system}"
BUCKET_NAME="${BUCKET_NAME:-sci-request-files-prod}"
SECRET_NAME="${SECRET_NAME:-JWT_SECRET}"
# เพิ่ม Localhost หลายพอร์ตเพื่อให้ยืดหยุ่นตอน Dev
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500|http://localhost:5173}"
TECH_SUPPORT_TARGET_EMAIL="${TECH_SUPPORT_TARGET_EMAIL:-piyaton56@gmail.com}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_SECURE="${SMTP_SECURE:-true}"
SMTP_HOST_VALUE="${SMTP_HOST_VALUE:-pstpyst.com}"
SMTP_USER_VALUE="${SMTP_USER_VALUE:-no-reply@pstpyst.com}"
SMTP_FROM_EMAIL_VALUE="${SMTP_FROM_EMAIL_VALUE:-no-reply@pstpyst.com}"
SMTP_FROM_NAME_VALUE="${SMTP_FROM_NAME_VALUE:-Sci Request Support}"
SMTP_PASS_VALUE="${SMTP_PASS_VALUE:-f5lN1n07}"
IAP_ENABLED="${IAP_ENABLED:-false}"
IAP_ALLOWED_DOMAINS="${IAP_ALLOWED_DOMAINS:-chula.ac.th,student.chula.ac.th}"
IAP_REQUIRE_HOSTED_DOMAIN="${IAP_REQUIRE_HOSTED_DOMAIN:-true}"
IAP_EXPECTED_AUDIENCE="${IAP_EXPECTED_AUDIENCE:-}"
IAP_BACKEND_SERVICE_ID="${IAP_BACKEND_SERVICE_ID:-}"
CLOUD_RUN_INGRESS="${CLOUD_RUN_INGRESS:-internal-and-cloud-load-balancing}"
AUTO_CONFIGURE_IAP_LB="${AUTO_CONFIGURE_IAP_LB:-false}"
LB_DOMAIN_NAMES="${LB_DOMAIN_NAMES:-}"
LB_NEG_NAME="${LB_NEG_NAME:-${SERVICE_NAME}-neg}"
LB_BACKEND_SERVICE_NAME="${LB_BACKEND_SERVICE_NAME:-${SERVICE_NAME}-backend}"
LB_URL_MAP_NAME="${LB_URL_MAP_NAME:-${SERVICE_NAME}-url-map}"
LB_HTTPS_PROXY_NAME="${LB_HTTPS_PROXY_NAME:-${SERVICE_NAME}-https-proxy}"
LB_HTTP_PROXY_NAME="${LB_HTTP_PROXY_NAME:-${SERVICE_NAME}-http-proxy}"
LB_HTTPS_FORWARDING_RULE_NAME="${LB_HTTPS_FORWARDING_RULE_NAME:-${SERVICE_NAME}-https-fr}"
LB_HTTP_FORWARDING_RULE_NAME="${LB_HTTP_FORWARDING_RULE_NAME:-${SERVICE_NAME}-http-fr}"
LB_GLOBAL_ADDRESS_NAME="${LB_GLOBAL_ADDRESS_NAME:-${SERVICE_NAME}-ip}"
LB_SSL_CERT_NAME="${LB_SSL_CERT_NAME:-${SERVICE_NAME}-managed-cert}"
IAP_OAUTH_CLIENT_ID="${IAP_OAUTH_CLIENT_ID:-}"
IAP_OAUTH_CLIENT_SECRET="${IAP_OAUTH_CLIENT_SECRET:-}"
IAP_ACCESS_MEMBERS="${IAP_ACCESS_MEMBERS:-}"
ENABLE_HTTP_REDIRECT_LB="${ENABLE_HTTP_REDIRECT_LB:-false}"
WAIT_FOR_MANAGED_CERTIFICATE="${WAIT_FOR_MANAGED_CERTIFICATE:-false}"
CERTIFICATE_WAIT_TIMEOUT_SECONDS="${CERTIFICATE_WAIT_TIMEOUT_SECONDS:-1800}"
CERTIFICATE_WAIT_INTERVAL_SECONDS="${CERTIFICATE_WAIT_INTERVAL_SECONDS:-30}"
WAIT_FOR_DNS_PROPAGATION="${WAIT_FOR_DNS_PROPAGATION:-false}"
DNS_WAIT_TIMEOUT_SECONDS="${DNS_WAIT_TIMEOUT_SECONDS:-1800}"
DNS_WAIT_INTERVAL_SECONDS="${DNS_WAIT_INTERVAL_SECONDS:-30}"
POST_DEPLOY_HEALTHCHECK_ENABLED="${POST_DEPLOY_HEALTHCHECK_ENABLED:-false}"
POST_DEPLOY_HEALTHCHECK_PATH="${POST_DEPLOY_HEALTHCHECK_PATH:-/healthz}"

# ชื่อ Secret ของ Key ต่างๆ
PRIV_KEY_SECRET="${PRIV_KEY_SECRET:-Gb_PRIVATE_KEY_BASE64}"
PUB_KEY_SECRET="${PUB_KEY_SECRET:-Gb_PUBLIC_KEY_BASE64}"
DB_KEY_SECRET="${DB_KEY_SECRET:-DB_ENCRYPTION_KEY}"
SMTP_HOST_SECRET="${SMTP_HOST_SECRET:-SMTP_HOST}"
SMTP_USER_SECRET="${SMTP_USER_SECRET:-SMTP_USER}"
SMTP_PASS_SECRET="${SMTP_PASS_SECRET:-SMTP_PASS}"
SMTP_FROM_EMAIL_SECRET="${SMTP_FROM_EMAIL_SECRET:-SMTP_FROM_EMAIL}"
SMTP_FROM_NAME_SECRET="${SMTP_FROM_NAME_SECRET:-SMTP_FROM_NAME}"

# 📍 App Region (แนะนำ asia-southeast1 (Singapore) เป็น Main Hub ใกล้ไทยสุดที่มีฟีเจอร์ครบ)
# หากต้องการใช้ Server ไทยแท้ๆ ให้เปลี่ยนเป็น "asia-southeast3" (แต่ต้องเช็ค Quota ของโปรเจ็คก่อน)
REGION="${REGION:-asia-southeast3}" 

# 🧠 AI Region (Global)
AI_LOCATION="${AI_LOCATION:-us-central1}"

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

SMTP_HOST_VALUE="$(trim_value "$SMTP_HOST_VALUE")"
SMTP_USER_VALUE="$(trim_value "$SMTP_USER_VALUE")"
SMTP_FROM_EMAIL_VALUE="$(trim_value "$SMTP_FROM_EMAIL_VALUE")"
SMTP_FROM_NAME_VALUE="$(trim_value "$SMTP_FROM_NAME_VALUE")"
SMTP_PORT="$(trim_value "$SMTP_PORT")"
SMTP_SECURE="$(trim_value "$SMTP_SECURE")"
TECH_SUPPORT_TARGET_EMAIL="$(trim_value "$TECH_SUPPORT_TARGET_EMAIL")"
FRONTEND_URL="$(trim_value "$FRONTEND_URL")"
LB_DOMAIN_NAMES="$(trim_value "$LB_DOMAIN_NAMES")"
IAP_OAUTH_CLIENT_ID="$(trim_value "$IAP_OAUTH_CLIENT_ID")"
IAP_OAUTH_CLIENT_SECRET="$(trim_value "$IAP_OAUTH_CLIENT_SECRET")"
IAP_ACCESS_MEMBERS="$(trim_value "$IAP_ACCESS_MEMBERS")"

require_command() {
    local NAME=$1
    if ! command -v "$NAME" &> /dev/null; then
        echo -e "${RED}❌ Error: $NAME is not installed.${NC}"
        exit 1
    fi
}

# 1. ตรวจสอบ gcloud และ Login
require_command gcloud
require_command openssl
require_command sed
require_command curl

CURRENT_PROJECT=$(gcloud config get-value project)
echo -e "🔎 Current Project: ${YELLOW}$CURRENT_PROJECT${NC}"

if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  Switching project to $PROJECT_ID...${NC}"
    gcloud config set project $PROJECT_ID
fi

# 2. เปิด APIs ที่จำเป็น (Enable APIs)
echo -e "${YELLOW}🛠️  Enabling required APIs... (This may take a minute)${NC}"
gcloud services enable \
    compute.googleapis.com \
    iap.googleapis.com \
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

validate_ingress_setting() {
    local VALUE=$1
    [[ "$VALUE" = "all" || "$VALUE" = "internal" || "$VALUE" = "internal-and-cloud-load-balancing" ]]
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

prompt_for_missing_config() {
    echo -e "${YELLOW}📝 Review SMTP/support config. Leave blank to use the shown default.${NC}"
    prompt_value_if_empty TECH_SUPPORT_TARGET_EMAIL "Support target email" "piyaton56@gmail.com"
    prompt_value_if_empty SMTP_HOST_VALUE "SMTP host" "pstpyst.com"
    prompt_value_if_empty SMTP_PORT "SMTP port" "465"
    prompt_value_if_empty SMTP_SECURE "SMTP secure (true/false)" "true"
    prompt_value_if_empty SMTP_USER_VALUE "SMTP username/email" "no-reply@pstpyst.com"
    prompt_value_if_empty SMTP_FROM_EMAIL_VALUE "SMTP from email" "no-reply@pstpyst.com"
    prompt_value_if_empty SMTP_FROM_NAME_VALUE "SMTP from name" "Sci Request Support"
    prompt_value_if_empty SMTP_PASS_VALUE "SMTP password" "" "true"

    SMTP_HOST_VALUE="$(trim_value "$SMTP_HOST_VALUE")"
    SMTP_USER_VALUE="$(trim_value "$SMTP_USER_VALUE")"
    SMTP_FROM_EMAIL_VALUE="$(trim_value "$SMTP_FROM_EMAIL_VALUE")"
    SMTP_FROM_NAME_VALUE="$(trim_value "$SMTP_FROM_NAME_VALUE")"
    SMTP_PORT="$(trim_value "$SMTP_PORT")"
    SMTP_SECURE="$(trim_value "$SMTP_SECURE")"
    TECH_SUPPORT_TARGET_EMAIL="$(trim_value "$TECH_SUPPORT_TARGET_EMAIL")"
}

ensure_smtp_password() {
    if [ -n "$SMTP_PASS_VALUE" ]; then
        return
    fi

    echo -e "${YELLOW}🔐 SMTP password not provided via SMTP_PASS_VALUE env. Please enter it now.${NC}"
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

    if [ "$SMTP_PORT" = "465" ] && [ "$SMTP_SECURE" != "true" ]; then
        echo -e "${RED}❌ SMTP_PORT 465 must use SMTP_SECURE=true${NC}"
        exit 1
    fi

    if [ "$SMTP_PORT" = "587" ] && [ "$SMTP_SECURE" != "false" ]; then
        echo -e "${RED}❌ SMTP_PORT 587 should use SMTP_SECURE=false${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$IAP_ENABLED"; then
        echo -e "${RED}❌ Invalid IAP_ENABLED: $IAP_ENABLED (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$IAP_REQUIRE_HOSTED_DOMAIN"; then
        echo -e "${RED}❌ Invalid IAP_REQUIRE_HOSTED_DOMAIN: $IAP_REQUIRE_HOSTED_DOMAIN (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_ingress_setting "$CLOUD_RUN_INGRESS"; then
        echo -e "${RED}❌ Invalid CLOUD_RUN_INGRESS: $CLOUD_RUN_INGRESS${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$AUTO_CONFIGURE_IAP_LB"; then
        echo -e "${RED}❌ Invalid AUTO_CONFIGURE_IAP_LB: $AUTO_CONFIGURE_IAP_LB (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$ENABLE_HTTP_REDIRECT_LB"; then
        echo -e "${RED}❌ Invalid ENABLE_HTTP_REDIRECT_LB: $ENABLE_HTTP_REDIRECT_LB (must be true or false)${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$WAIT_FOR_MANAGED_CERTIFICATE"; then
        echo -e "${RED}❌ Invalid WAIT_FOR_MANAGED_CERTIFICATE: $WAIT_FOR_MANAGED_CERTIFICATE (must be true or false)${NC}"
        exit 1
    fi

    if ! [[ "$CERTIFICATE_WAIT_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$CERTIFICATE_WAIT_TIMEOUT_SECONDS" -le 0 ]; then
        echo -e "${RED}❌ Invalid CERTIFICATE_WAIT_TIMEOUT_SECONDS: $CERTIFICATE_WAIT_TIMEOUT_SECONDS${NC}"
        exit 1
    fi

    if ! [[ "$CERTIFICATE_WAIT_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [ "$CERTIFICATE_WAIT_INTERVAL_SECONDS" -le 0 ]; then
        echo -e "${RED}❌ Invalid CERTIFICATE_WAIT_INTERVAL_SECONDS: $CERTIFICATE_WAIT_INTERVAL_SECONDS${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$WAIT_FOR_DNS_PROPAGATION"; then
        echo -e "${RED}❌ Invalid WAIT_FOR_DNS_PROPAGATION: $WAIT_FOR_DNS_PROPAGATION (must be true or false)${NC}"
        exit 1
    fi

    if ! [[ "$DNS_WAIT_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$DNS_WAIT_TIMEOUT_SECONDS" -le 0 ]; then
        echo -e "${RED}❌ Invalid DNS_WAIT_TIMEOUT_SECONDS: $DNS_WAIT_TIMEOUT_SECONDS${NC}"
        exit 1
    fi

    if ! [[ "$DNS_WAIT_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [ "$DNS_WAIT_INTERVAL_SECONDS" -le 0 ]; then
        echo -e "${RED}❌ Invalid DNS_WAIT_INTERVAL_SECONDS: $DNS_WAIT_INTERVAL_SECONDS${NC}"
        exit 1
    fi

    if ! validate_boolean_string "$POST_DEPLOY_HEALTHCHECK_ENABLED"; then
        echo -e "${RED}❌ Invalid POST_DEPLOY_HEALTHCHECK_ENABLED: $POST_DEPLOY_HEALTHCHECK_ENABLED (must be true or false)${NC}"
        exit 1
    fi

    if [ "$AUTO_CONFIGURE_IAP_LB" = "true" ]; then
        if [ -z "$LB_DOMAIN_NAMES" ]; then
            echo -e "${RED}❌ LB_DOMAIN_NAMES is required when AUTO_CONFIGURE_IAP_LB=true${NC}"
            exit 1
        fi
    fi
}

resolve_deploy_mode_settings() {
    if [ "$AUTO_CONFIGURE_IAP_LB" = "true" ] || [ "$IAP_ENABLED" = "true" ]; then
        CLOUD_RUN_INGRESS="internal-and-cloud-load-balancing"
        RUN_AUTH_FLAG="--allow-unauthenticated"
        return
    fi

    CLOUD_RUN_INGRESS="all"
    RUN_AUTH_FLAG="--allow-unauthenticated"
}

print_deploy_summary() {
    echo -e "${YELLOW}📋 Deployment configuration summary${NC}"
    echo -e "   Project ID              : ${YELLOW}$PROJECT_ID${NC}"
    echo -e "   Service Name            : ${YELLOW}$SERVICE_NAME${NC}"
    echo -e "   Bucket                  : ${YELLOW}$BUCKET_NAME${NC}"
    echo -e "   Frontend URL(s)         : ${YELLOW}$FRONTEND_URL${NC}"
    echo -e "   Support Target Email    : ${YELLOW}$TECH_SUPPORT_TARGET_EMAIL${NC}"
    echo -e "   SMTP Host               : ${YELLOW}$SMTP_HOST_VALUE${NC}"
    echo -e "   SMTP Port               : ${YELLOW}$SMTP_PORT${NC}"
    echo -e "   SMTP Secure             : ${YELLOW}$SMTP_SECURE${NC}"
    echo -e "   SMTP User               : ${YELLOW}$SMTP_USER_VALUE${NC}"
    echo -e "   SMTP From Email         : ${YELLOW}$SMTP_FROM_EMAIL_VALUE${NC}"
    echo -e "   SMTP From Name          : ${YELLOW}$SMTP_FROM_NAME_VALUE${NC}"
    echo -e "   IAP Enabled             : ${YELLOW}$IAP_ENABLED${NC}"
    echo -e "   IAP Allowed Domains     : ${YELLOW}$IAP_ALLOWED_DOMAINS${NC}"
    echo -e "   IAP Require HD          : ${YELLOW}$IAP_REQUIRE_HOSTED_DOMAIN${NC}"
    echo -e "   IAP Expected Audience   : ${YELLOW}${IAP_EXPECTED_AUDIENCE:-<auto>}${NC}"
    echo -e "   IAP Backend Service ID  : ${YELLOW}${IAP_BACKEND_SERVICE_ID:-<not set>}${NC}"
    echo -e "   Cloud Run Ingress       : ${YELLOW}$CLOUD_RUN_INGRESS${NC}"
    echo -e "   Run Auth Flag           : ${YELLOW}$RUN_AUTH_FLAG${NC}"
    echo -e "   Auto Configure LB/IAP   : ${YELLOW}$AUTO_CONFIGURE_IAP_LB${NC}"
    echo -e "   LB Domains              : ${YELLOW}${LB_DOMAIN_NAMES:-<not set>}${NC}"
    echo -e "   LB Backend Service      : ${YELLOW}$LB_BACKEND_SERVICE_NAME${NC}"
    echo -e "   LB NEG                  : ${YELLOW}$LB_NEG_NAME${NC}"
    echo -e "   LB URL Map              : ${YELLOW}$LB_URL_MAP_NAME${NC}"
    echo -e "   LB HTTPS Proxy          : ${YELLOW}$LB_HTTPS_PROXY_NAME${NC}"
    echo -e "   LB Global Address       : ${YELLOW}$LB_GLOBAL_ADDRESS_NAME${NC}"
    echo -e "   Wait For Cert           : ${YELLOW}$WAIT_FOR_MANAGED_CERTIFICATE${NC}"
    echo -e "   Wait For DNS            : ${YELLOW}$WAIT_FOR_DNS_PROPAGATION${NC}"
    echo -e "   Post Deploy Healthcheck : ${YELLOW}$POST_DEPLOY_HEALTHCHECK_ENABLED${NC}"
}

resource_exists() {
    "$@" &> /dev/null
}

ensure_global_address() {
    if resource_exists gcloud compute addresses describe "$LB_GLOBAL_ADDRESS_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ Global address exists: $LB_GLOBAL_ADDRESS_NAME"
    else
        echo -e "   🌐 Creating global IP address: $LB_GLOBAL_ADDRESS_NAME"
        gcloud compute addresses create "$LB_GLOBAL_ADDRESS_NAME" \
            --global \
            --ip-version=IPV4 \
            --project "$PROJECT_ID"
    fi
}

ensure_managed_certificate() {
    if resource_exists gcloud compute ssl-certificates describe "$LB_SSL_CERT_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ Managed certificate exists: $LB_SSL_CERT_NAME"
    else
        echo -e "   🔒 Creating managed certificate: $LB_SSL_CERT_NAME"
        gcloud compute ssl-certificates create "$LB_SSL_CERT_NAME" \
            --domains="$LB_DOMAIN_NAMES" \
            --global \
            --project "$PROJECT_ID"
    fi
}

ensure_serverless_neg() {
    if resource_exists gcloud compute network-endpoint-groups describe "$LB_NEG_NAME" --region "$REGION" --project "$PROJECT_ID"; then
        echo -e "   ✅ Serverless NEG exists: $LB_NEG_NAME"
    else
        echo -e "   🔗 Creating serverless NEG: $LB_NEG_NAME"
        gcloud compute network-endpoint-groups create "$LB_NEG_NAME" \
            --region="$REGION" \
            --network-endpoint-type=serverless \
            --cloud-run-service="$SERVICE_NAME" \
            --project "$PROJECT_ID"
    fi
}

ensure_backend_service() {
    if resource_exists gcloud compute backend-services describe "$LB_BACKEND_SERVICE_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ Backend service exists: $LB_BACKEND_SERVICE_NAME"
    else
        echo -e "   🧩 Creating backend service: $LB_BACKEND_SERVICE_NAME"
        gcloud compute backend-services create "$LB_BACKEND_SERVICE_NAME" \
            --global \
            --load-balancing-scheme=EXTERNAL_MANAGED \
            --protocol=HTTP \
            --project "$PROJECT_ID"
    fi

    local NEG_LINKS
    NEG_LINKS=$(gcloud compute backend-services describe "$LB_BACKEND_SERVICE_NAME" \
        --global \
        --project "$PROJECT_ID" \
        --format='value(backends[].group)' 2>/dev/null || true)

    if printf '%s\n' "$NEG_LINKS" | grep -q "/$LB_NEG_NAME\$"; then
        echo -e "   ✅ NEG already attached to backend service"
    else
        echo -e "   ➕ Attaching NEG to backend service"
        gcloud compute backend-services add-backend "$LB_BACKEND_SERVICE_NAME" \
            --global \
            --network-endpoint-group="$LB_NEG_NAME" \
            --network-endpoint-group-region="$REGION" \
            --project "$PROJECT_ID"
    fi
}

ensure_url_map() {
    if resource_exists gcloud compute url-maps describe "$LB_URL_MAP_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ URL map exists: $LB_URL_MAP_NAME"
    else
        echo -e "   🗺️  Creating URL map: $LB_URL_MAP_NAME"
        gcloud compute url-maps create "$LB_URL_MAP_NAME" \
            --default-service="$LB_BACKEND_SERVICE_NAME" \
            --global \
            --project "$PROJECT_ID"
    fi
}

ensure_https_proxy() {
    if resource_exists gcloud compute target-https-proxies describe "$LB_HTTPS_PROXY_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ HTTPS proxy exists: $LB_HTTPS_PROXY_NAME"
    else
        echo -e "   🔐 Creating HTTPS proxy: $LB_HTTPS_PROXY_NAME"
        gcloud compute target-https-proxies create "$LB_HTTPS_PROXY_NAME" \
            --url-map="$LB_URL_MAP_NAME" \
            --ssl-certificates="$LB_SSL_CERT_NAME" \
            --global \
            --project "$PROJECT_ID"
    fi
}

ensure_https_forwarding_rule() {
    if resource_exists gcloud compute forwarding-rules describe "$LB_HTTPS_FORWARDING_RULE_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ✅ HTTPS forwarding rule exists: $LB_HTTPS_FORWARDING_RULE_NAME"
    else
        echo -e "   🚦 Creating HTTPS forwarding rule: $LB_HTTPS_FORWARDING_RULE_NAME"
        gcloud compute forwarding-rules create "$LB_HTTPS_FORWARDING_RULE_NAME" \
            --global \
            --load-balancing-scheme=EXTERNAL_MANAGED \
            --target-https-proxy="$LB_HTTPS_PROXY_NAME" \
            --global-target-https-proxy \
            --address="$LB_GLOBAL_ADDRESS_NAME" \
            --ports=443 \
            --project "$PROJECT_ID"
    fi
}

ensure_http_redirect_resources() {
    if [ "$ENABLE_HTTP_REDIRECT_LB" != "true" ]; then
        return
    fi

    if ! resource_exists gcloud compute target-http-proxies describe "$LB_HTTP_PROXY_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   ↪️  Creating HTTP proxy for redirect/temporary HTTP routing: $LB_HTTP_PROXY_NAME"
        gcloud compute target-http-proxies create "$LB_HTTP_PROXY_NAME" \
            --url-map="$LB_URL_MAP_NAME" \
            --global \
            --project "$PROJECT_ID"
    else
        echo -e "   ✅ HTTP proxy exists: $LB_HTTP_PROXY_NAME"
    fi

    if ! resource_exists gcloud compute forwarding-rules describe "$LB_HTTP_FORWARDING_RULE_NAME" --global --project "$PROJECT_ID"; then
        echo -e "   🚦 Creating HTTP forwarding rule: $LB_HTTP_FORWARDING_RULE_NAME"
        gcloud compute forwarding-rules create "$LB_HTTP_FORWARDING_RULE_NAME" \
            --global \
            --load-balancing-scheme=EXTERNAL_MANAGED \
            --target-http-proxy="$LB_HTTP_PROXY_NAME" \
            --global-target-http-proxy \
            --address="$LB_GLOBAL_ADDRESS_NAME" \
            --ports=80 \
            --project "$PROJECT_ID"
    else
        echo -e "   ✅ HTTP forwarding rule exists: $LB_HTTP_FORWARDING_RULE_NAME"
    fi
}

configure_iap_on_backend_service() {
    echo -e "   🪪 Enabling IAP on backend service: $LB_BACKEND_SERVICE_NAME"
    if [ -n "$IAP_OAUTH_CLIENT_ID" ] && [ -n "$IAP_OAUTH_CLIENT_SECRET" ]; then
        gcloud compute backend-services update "$LB_BACKEND_SERVICE_NAME" \
            --global \
            --iap=enabled,oauth2-client-id="$IAP_OAUTH_CLIENT_ID",oauth2-client-secret="$IAP_OAUTH_CLIENT_SECRET" \
            --project "$PROJECT_ID"
        return
    fi

    echo -e "   ℹ️  No custom OAuth client provided. Falling back to Google-managed OAuth client for IAP."
    gcloud compute backend-services update "$LB_BACKEND_SERVICE_NAME" \
        --global \
        --iap=enabled \
        --project "$PROJECT_ID"
}

grant_iap_access_bindings() {
    if [ -z "$IAP_ACCESS_MEMBERS" ]; then
        echo -e "   ℹ️  IAP_ACCESS_MEMBERS not set. Skipping IAP IAM binding automation."
        return
    fi

    echo -e "   👥 Applying IAP access bindings"
    while IFS= read -r MEMBER; do
        [ -z "$MEMBER" ] && continue
        gcloud iap web add-iam-policy-binding \
            --resource-type=backend-services \
            --service="$LB_BACKEND_SERVICE_NAME" \
            --member="$MEMBER" \
            --role="roles/iap.httpsResourceAccessor" \
            --project "$PROJECT_ID" \
            --quiet || true
    done < <(split_csv "$IAP_ACCESS_MEMBERS")
}

print_dns_instructions() {
    echo -e "${YELLOW}📌 DNS setup${NC}"
    while IFS= read -r DOMAIN; do
        [ -z "$DOMAIN" ] && continue
        echo -e "   ${YELLOW}$DOMAIN${NC} -> ${YELLOW}$LB_IP_ADDRESS${NC}"
    done < <(split_csv "$LB_DOMAIN_NAMES")
}

resolve_domain_ipv4() {
    local DOMAIN=$1
    local RESOLVED_IP=""

    RESOLVED_IP=$(curl -4 -s "https://dns.google/resolve?name=${DOMAIN}&type=A" 2>/dev/null | sed -n 's/.*"data":"\([0-9.]*\)".*/\1/p' | head -n 1)
    printf '%s' "$RESOLVED_IP"
}

wait_for_dns_propagation() {
    if [ "$WAIT_FOR_DNS_PROPAGATION" != "true" ]; then
        echo -e "   ℹ️  Skipping DNS wait because WAIT_FOR_DNS_PROPAGATION=false"
        return
    fi

    local START_TS
    START_TS=$(date +%s)
    local DEADLINE=$((START_TS + DNS_WAIT_TIMEOUT_SECONDS))

    echo -e "   ⏳ Waiting for DNS to point to ${YELLOW}${LB_IP_ADDRESS}${NC}"

    while IFS= read -r DOMAIN; do
        [ -z "$DOMAIN" ] && continue
        echo -e "   🌐 Checking DNS for ${YELLOW}${DOMAIN}${NC}"

        while true; do
            local NOW
            NOW=$(date +%s)
            if [ "$NOW" -ge "$DEADLINE" ]; then
                echo -e "   ⚠️  Timed out waiting for DNS propagation after ${DNS_WAIT_TIMEOUT_SECONDS}s"
                return
            fi

            local RESOLVED_IP
            RESOLVED_IP=$(resolve_domain_ipv4 "$DOMAIN")
            echo -e "   🔎 ${DOMAIN} resolved to: ${YELLOW}${RESOLVED_IP:-<not resolved>}${NC}"

            if [ "$RESOLVED_IP" = "$LB_IP_ADDRESS" ]; then
                echo -e "   ✅ DNS is pointing correctly for ${DOMAIN}"
                break
            fi

            sleep "$DNS_WAIT_INTERVAL_SECONDS"
        done
    done < <(split_csv "$LB_DOMAIN_NAMES")
}

wait_for_managed_certificate() {
    if [ "$WAIT_FOR_MANAGED_CERTIFICATE" != "true" ]; then
        echo -e "   ℹ️  Skipping certificate wait because WAIT_FOR_MANAGED_CERTIFICATE=false"
        return
    fi

    local START_TS
    START_TS=$(date +%s)
    local DEADLINE=$((START_TS + CERTIFICATE_WAIT_TIMEOUT_SECONDS))

    echo -e "   ⏳ Waiting for managed certificate to become ACTIVE..."
    echo -e "   ℹ️  This requires DNS for ${YELLOW}${LB_DOMAIN_NAMES}${NC} to point to ${YELLOW}${LB_IP_ADDRESS}${NC}"

    while true; do
        local NOW
        NOW=$(date +%s)
        if [ "$NOW" -ge "$DEADLINE" ]; then
            echo -e "   ⚠️  Timed out waiting for certificate after ${CERTIFICATE_WAIT_TIMEOUT_SECONDS}s"
            return
        fi

        local CERT_STATUS
        CERT_STATUS=$(gcloud compute ssl-certificates describe "$LB_SSL_CERT_NAME" \
            --global \
            --project "$PROJECT_ID" \
            --format='value(managed.status)' 2>/dev/null || true)

        local DOMAIN_STATUS
        DOMAIN_STATUS=$(gcloud compute ssl-certificates describe "$LB_SSL_CERT_NAME" \
            --global \
            --project "$PROJECT_ID" \
            --format='json(managed.domainStatus)' 2>/dev/null || true)

        echo -e "   🔎 Certificate status: ${YELLOW}${CERT_STATUS:-UNKNOWN}${NC}"
        if [ -n "$DOMAIN_STATUS" ]; then
            echo -e "   🔎 Domain status: ${YELLOW}${DOMAIN_STATUS}${NC}"
        fi

        if [ "$CERT_STATUS" = "ACTIVE" ]; then
            echo -e "   ✅ Managed certificate is ACTIVE"
            return
        fi

        sleep "$CERTIFICATE_WAIT_INTERVAL_SECONDS"
    done
}

run_post_deploy_healthcheck() {
    if [ "$POST_DEPLOY_HEALTHCHECK_ENABLED" != "true" ]; then
        echo -e "   ℹ️  Skipping post-deploy healthcheck because POST_DEPLOY_HEALTHCHECK_ENABLED=false"
        return
    fi

    local PRIMARY_DOMAIN
    PRIMARY_DOMAIN=$(split_csv "$LB_DOMAIN_NAMES" | head -n 1)

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

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
        echo -e "   ✅ HTTPS endpoint is responding."
        return
    fi

    echo -e "   ⚠️  HTTPS endpoint did not return an expected status yet."
}

auto_configure_iap_load_balancer() {
    if [ "$AUTO_CONFIGURE_IAP_LB" != "true" ]; then
        return
    fi

    echo -e "${YELLOW}🌐 Auto-configuring External HTTPS Load Balancer + IAP...${NC}"
    ensure_global_address
    ensure_managed_certificate
    ensure_serverless_neg
    ensure_backend_service
    ensure_url_map
    ensure_https_proxy
    ensure_https_forwarding_rule
    ensure_http_redirect_resources
    configure_iap_on_backend_service
    grant_iap_access_bindings

    LB_IP_ADDRESS=$(gcloud compute addresses describe "$LB_GLOBAL_ADDRESS_NAME" \
        --global \
        --project "$PROJECT_ID" \
        --format='value(address)')

    DETECTED_BACKEND_SERVICE_ID=$(gcloud compute backend-services describe "$LB_BACKEND_SERVICE_NAME" \
        --global \
        --project "$PROJECT_ID" \
        --format='value(id)')

    if [ -n "$DETECTED_BACKEND_SERVICE_ID" ]; then
        IAP_BACKEND_SERVICE_ID="$DETECTED_BACKEND_SERVICE_ID"
        if [ -z "$IAP_EXPECTED_AUDIENCE" ]; then
            IAP_EXPECTED_AUDIENCE="/projects/${PROJECT_NUMBER}/global/backendServices/${DETECTED_BACKEND_SERVICE_ID}"
        fi
    fi

    echo -e "   ✅ Load balancer and IAP configuration completed."
    echo -e "   🌍 Reserved IP: ${YELLOW}${LB_IP_ADDRESS}${NC}"
    echo -e "   🧾 Backend Service ID: ${YELLOW}${IAP_BACKEND_SERVICE_ID}${NC}"
    echo -e "   🪪 IAP Audience: ${YELLOW}${IAP_EXPECTED_AUDIENCE}${NC}"
    print_dns_instructions
    wait_for_dns_propagation
    wait_for_managed_certificate
    run_post_deploy_healthcheck
}

# 5. จัดการ Secrets และ Keys
echo -e "${YELLOW}🔐 Managing Secrets & Keys...${NC}"

prompt_for_missing_config
validate_smtp_config
ensure_smtp_password
resolve_deploy_mode_settings
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
  --source "$SCRIPT_DIR" \
  --region "$REGION" \
  --ingress "$CLOUD_RUN_INGRESS" \
  "$RUN_AUTH_FLAG" \
  --set-env-vars "^__ENV_DELIM__^GCP_PROJECT_ID=${PROJECT_ID}__ENV_DELIM__GCP_PROJECT_NUMBER=${PROJECT_NUMBER}__ENV_DELIM__GCS_BUCKET_NAME=${BUCKET_NAME}__ENV_DELIM__APP_REGION=${REGION}__ENV_DELIM__GCP_LOCATION=${AI_LOCATION}__ENV_DELIM__FRONTEND_URL=${FRONTEND_URL}__ENV_DELIM__TECH_SUPPORT_TARGET_EMAIL=${TECH_SUPPORT_TARGET_EMAIL}__ENV_DELIM__SMTP_PORT=${SMTP_PORT}__ENV_DELIM__SMTP_SECURE=${SMTP_SECURE}__ENV_DELIM__IAP_ENABLED=${IAP_ENABLED}__ENV_DELIM__IAP_ALLOWED_DOMAINS=${IAP_ALLOWED_DOMAINS}__ENV_DELIM__IAP_REQUIRE_HOSTED_DOMAIN=${IAP_REQUIRE_HOSTED_DOMAIN}__ENV_DELIM__IAP_EXPECTED_AUDIENCE=${IAP_EXPECTED_AUDIENCE}__ENV_DELIM__IAP_BACKEND_SERVICE_ID=${IAP_BACKEND_SERVICE_ID}" \
  --set-secrets JWT_SECRET="$SECRET_NAME:latest" \
  --set-secrets Gb_PRIVATE_KEY_BASE64="$PRIV_KEY_SECRET:latest" \
  --set-secrets Gb_PUBLIC_KEY_BASE64="$PUB_KEY_SECRET:latest" \
  --set-secrets DB_ENCRYPTION_KEY="$DB_KEY_SECRET:latest" \
  --set-secrets SMTP_HOST="$SMTP_HOST_SECRET:latest" \
  --set-secrets SMTP_USER="$SMTP_USER_SECRET:latest" \
  --set-secrets SMTP_PASS="$SMTP_PASS_SECRET:latest" \
  --set-secrets SMTP_FROM_EMAIL="$SMTP_FROM_EMAIL_SECRET:latest" \
  --set-secrets SMTP_FROM_NAME="$SMTP_FROM_NAME_SECRET:latest"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}--------------------------------------------------${NC}"
  echo -e "${GREEN}✅ Deployment Successful!${NC}"
  echo -e "${GREEN}--------------------------------------------------${NC}"
else
  echo -e "${RED}--------------------------------------------------${NC}"
  echo -e "${RED}❌ Deployment Failed!${NC}"
  exit 1
fi

auto_configure_iap_load_balancer

if [ "$AUTO_CONFIGURE_IAP_LB" = "true" ] && [ -n "$IAP_EXPECTED_AUDIENCE" ]; then
  echo -e "${YELLOW}🔄 Updating Cloud Run env with auto-detected IAP audience...${NC}"
  gcloud run services update "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --update-env-vars "^__ENV_DELIM__^IAP_EXPECTED_AUDIENCE=${IAP_EXPECTED_AUDIENCE}__ENV_DELIM__IAP_BACKEND_SERVICE_ID=${IAP_BACKEND_SERVICE_ID}"
fi
