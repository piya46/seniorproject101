# Deploy Runbook

Last updated: `2026-03-30`

runbook นี้อธิบายการ deploy backend ในโหมด Google OIDC แบบไม่ใช้ IAP/LB auth gate โดยรองรับทั้ง backend แบบ public ชั่วคราวและ backend แบบ private หลัง frontend BFF

เอกสารประกอบ:

- incident/threat model แบบย่ออยู่ที่ [INCIDENT_RUNBOOK.md](/Users/pst./senior/backend/INCIDENT_RUNBOOK.md)
- contract ระหว่าง frontend BFF กับ backend private อยู่ที่ [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)

หมายเหตุสำคัญ:

- production target ที่แนะนำตอนนี้คือ frontend public + backend private
- backend ยัง deploy เป็น Cloud Run `run.app` เสมอ แต่สามารถตั้ง `CLOUD_RUN_AUTH_MODE=private` ได้
- domain mapping, LB fallback, และ legacy LB cleanup ถูกแยกออกจาก deploy หลักแล้ว

## Prerequisites

- มีสิทธิ์ใช้ Cloud Run, Cloud Build, Secret Manager, Storage, IAM, Scheduler
- มีสิทธิ์ใช้ Firestore database/TTL administration
- มี Google OAuth client สำหรับ web application
- มี Google OAuth client สำหรับ backend ตัวนี้

## Default Naming Scheme

ค่า default ปัจจุบันของ `deploy.sh` ถูกตั้งให้แยก frontend/backend ชัดเจนในโปรเจกต์ `ai-formcheck`:

- `PROJECT_ID=ai-formcheck`
- `APP_NAME=ai-formcheck`
- `SERVICE_NAME=ai-formcheck-backend`
- `FRONTEND_SERVICE_NAME=ai-formcheck-frontend`
- `FRONTEND_SERVICE_ACCOUNT_NAME=ai-formcheck-frontend-sa`
- `CLEANUP_SERVICE_NAME=ai-formcheck-backend-cleanup`
- `BUCKET_NAME=ai-formcheck-backend-files`
- `FIRESTORE_DATABASE_ID=ai-formcheck`

ถ้า `FRONTEND_URL` ไม่ถูกกำหนดตอน deploy สคริปต์จะ derive เป็น canonical Cloud Run URL ของ `FRONTEND_SERVICE_NAME` ให้อัตโนมัติ

## Auto Bootstrap By `deploy.sh`

สิ่งที่ `deploy.sh` จัดการให้เองในฝั่ง Google Cloud:

- enable APIs ที่ใช้ใน deployment/runtime เช่น Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, Storage, IAM, Cloud Scheduler
- enable APIs ที่ใช้กับ signed URL และ service-account-based signing เช่น IAM Credentials API
- create/update Cloud Run service หลัก
- create bucket ถ้ายังไม่มี
- apply bucket lifecycle policy ถ้าเปิด flag ที่เกี่ยวข้อง
- create/check Firestore database ที่ app ใช้งาน
- enable Firestore TTL policies สำหรับ `used_nonces.expire_at`, `RATE_LIMITS.expireAt`, และ `AI_USAGE_DAILY.expire_at`
- create/update app service account และ cleanup service account
- grant IAM bindings ที่ backend และ cleanup service ต้องใช้
- create/update secrets สำหรับ JWT, DB encryption key, SMTP, OIDC client secret values, และ key pair
- deploy cleanup service และ create/update Cloud Scheduler job

ข้อควรทราบ:

- Cloud Run service ถ้ายังไม่มี สคริปต์จะสร้างให้ตอน `gcloud run deploy`
- bucket ถ้ายังไม่มี สคริปต์จะสร้างให้ แต่ถ้ามี bucket ชื่อเดิมอยู่คนละ location จะไม่ย้าย location แบบเงียบ ๆ และต้องใช้ migration flow ของสคริปต์แทน
- Firestore database ไม่ควรหวังให้ runtime สร้างเอง ตอนนี้ `deploy.sh` จะเช็ก/สร้างก่อน deploy app
- Firestore TTL เป็น eventual rollout ของ Google Cloud หลังเปิด policy แล้ว สถานะอาจใช้เวลาสักพักกว่าจะสะท้อนครบ
- app service account ตอนนี้ใช้ secret-level access สำหรับ secrets ที่ runtime ใช้จริง แทน project-wide `secretmanager.secretAccessor`
- app และ cleanup service account ถูกลด bucket role ลงมาเป็น `roles/storage.objectUser` ซึ่งยังพอสำหรับ read/write/delete object ตาม flow ปัจจุบัน
- app service account มี self `roles/iam.serviceAccountTokenCreator` เพื่อรองรับ `getSignedUrl()` ผ่าน `signBlob`

## Manual OAuth Provider Setup

สิ่งที่ยังต้องทำเองฝั่ง Google OAuth provider / Google Cloud Console:

- สร้าง Google OAuth client ที่จะใช้กับ frontend/web application
- สร้าง Google OAuth client สำหรับ backend ตัวนี้ ถ้ายังไม่มี
- ใส่ Authorized redirect URI ให้ตรงกับ callback URL ที่ใช้จริงแบบ exact match
- ถ้ามีการเปลี่ยน domain, region, หรือ callback URL ต้องอัปเดตรายการ redirect URI ใน OAuth client เอง

`deploy.sh` ทำได้แค่:

- เก็บ `GOOGLE_OIDC_CLIENT_ID` และ `GOOGLE_OIDC_CLIENT_SECRET` เข้า Secret Manager
- inject ค่าเหล่านี้เข้า Cloud Run
- default `GOOGLE_OIDC_CALLBACK_URL` ให้ตรง canonical `run.app` URL ถ้าไม่ได้ override

`deploy.sh` ยังไม่ได้:

- สร้าง OAuth client ให้อัตโนมัติ
- แก้ Authorized redirect URIs ใน provider ให้อัตโนมัติ
- แก้ consent screen / publishing status / branding ฝั่ง OAuth provider

## Required OIDC Config

ค่าหลัก:

- `OIDC_ENABLED=true`
- `OIDC_ALLOWED_DOMAINS=chula.ac.th,student.chula.ac.th`
- `OIDC_REQUIRE_HOSTED_DOMAIN=true`
- `GOOGLE_OIDC_CLIENT_ID_VALUE=<google client id>`
- `GOOGLE_OIDC_CLIENT_SECRET_VALUE=<google client secret>`
- `GOOGLE_OIDC_CALLBACK_URL=https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback` (optional; ใช้กับ legacy/direct mode และเป็น default callback ของ backend ถ้าไม่ได้ override)

หมายเหตุ:

- ถ้า Secret Manager มี `GOOGLE_OIDC_CLIENT_ID` และ `GOOGLE_OIDC_CLIENT_SECRET` อยู่แล้ว สคริปต์จะพยายาม reuse ให้อัตโนมัติก่อน prompt
- ค่า `GOOGLE_OIDC_CLIENT_ID_VALUE` และ `GOOGLE_OIDC_CLIENT_SECRET_VALUE` จึงจำเป็นเฉพาะตอน bootstrap ครั้งแรกหรือเมื่อต้องการอัปเดต secret
- ถ้าจะเดินหน้าไปสู่ private backend เต็มรูปแบบ ให้ใช้เอกสาร [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md) ควบคู่กัน เพราะ OIDC ownership และ callback flow จะเปลี่ยนตามสถาปัตยกรรม BFF
- ใน production BFF flow Google OAuth redirect URI ควรเป็น frontend callback เช่น `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/callback`
- route backend `GET /api/v1/oidc/bff/google/callback` ใช้เป็น bridge ระหว่าง frontend callback กับ backend session issuance ไม่ใช่ Google redirect URI ตรง

## BFF / Private Backend Flags

ค่าเหล่านี้ใช้เมื่อ frontend ทำหน้าที่เป็น Backend-for-Frontend (BFF) และ backend ต้องเป็น private service:

```bash
export CLOUD_RUN_AUTH_MODE="private"
export FRONTEND_SERVICE_ACCOUNT_NAME="ai-formcheck-frontend-sa"
export TRUST_PROXY_BROWSER_ORIGIN_HEADER="true"
export BROWSER_ORIGIN_HEADER_NAME="x-browser-origin"
export TRUSTED_BFF_AUTH_ENABLED="true"
export TRUSTED_BFF_AUTH_HEADER_NAME="x-bff-auth"
export TRUSTED_BFF_SHARED_SECRET_VALUE="your-bff-shared-secret"
```

หมายเหตุ:

- เมื่อ `CLOUD_RUN_AUTH_MODE=private` สคริปต์จะ deploy backend ด้วย `--no-allow-unauthenticated`
- หลัง deploy สคริปต์จะพยายาม grant `roles/run.invoker` ให้ frontend service account
- เมื่อ `TRUSTED_BFF_AUTH_ENABLED=true` สคริปต์จะเก็บ shared secret ลง Secret Manager และ inject เข้า backend runtime
- origin forwarding ผ่าน `x-browser-origin` จะถูกไว้ใจได้ก็ต่อเมื่อ backend เป็น private และเรียกผ่าน BFF เท่านั้น
- header contract ที่ frontend ต้องส่งดูได้ที่ [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)
- frontend BFF production flow ที่โค้ดรองรับตอนนี้คือ:
  1. browser เรียก `/auth/login` บน frontend
  2. frontend เรียก backend `GET /api/v1/oidc/bff/google/login-url`
  3. Google redirect กลับ `/auth/callback` บน frontend
  4. frontend เรียก backend `GET /api/v1/oidc/bff/google/callback`

## Recommended Production Config

```bash
export APP_NAME="ai-formcheck"
export SERVICE_NAME="ai-formcheck-backend"
export FRONTEND_SERVICE_NAME="ai-formcheck-frontend"
export FRONTEND_SERVICE_ACCOUNT_NAME="ai-formcheck-frontend-sa"
export FRONTEND_URL="https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app"
export FRONTEND_EXTRA_URLS=""
export CLOUD_RUN_AUTH_MODE="private"
export TRUST_PROXY_BROWSER_ORIGIN_HEADER="true"
export BROWSER_ORIGIN_HEADER_NAME="x-browser-origin"
export TECH_SUPPORT_TARGET_EMAIL="support@example.com"
export SMTP_HOST_VALUE="smtp.example.com"
export SMTP_PORT="465"
export SMTP_SECURE="true"
export SMTP_USER_VALUE="no-reply@example.com"
export SMTP_FROM_EMAIL_VALUE="no-reply@example.com"
export SMTP_FROM_NAME_VALUE="AI FormCheck Support"
export SMTP_PASS_VALUE="your-smtp-password"
export OIDC_ENABLED="true"
export OIDC_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
export OIDC_REQUIRE_HOSTED_DOMAIN="true"
export AI_LOCATION="us-central1"
export AI_DAILY_TOKEN_LIMIT="50000"
export AI_USAGE_RETENTION_DAYS="30"
export GOOGLE_OIDC_CLIENT_ID_VALUE="your-google-client-id"
export GOOGLE_OIDC_CLIENT_SECRET_VALUE="your-google-client-secret"
export GOOGLE_OIDC_CALLBACK_URL="https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback"
export TRUSTED_BFF_AUTH_ENABLED="true"
export TRUSTED_BFF_AUTH_HEADER_NAME="x-bff-auth"
export TRUSTED_BFF_SHARED_SECRET_VALUE="your-bff-shared-secret"
```

หมายเหตุ:

- `FRONTEND_URL` ควรเป็น production origin หลักเพียงค่าเดียว
- ถ้า frontend ก็ deploy เป็น Cloud Run ในโปรเจกต์เดียวกัน สามารถไม่ export `FRONTEND_URL` ได้ และปล่อยให้ `deploy.sh` derive จาก `FRONTEND_SERVICE_NAME` แทน
- `FRONTEND_EXTRA_URLS` เป็น temporary dev/QA override เท่านั้น
- ถ้าต้องการ deploy แบบ non-interactive หรือรันใน CI ควร export ชุด `SMTP_*` และ `TECH_SUPPORT_TARGET_EMAIL` ให้ครบ ไม่เช่นนั้น `deploy.sh` จะ prompt ถามค่าระหว่างรัน
- ถ้า Secret Manager มี `SMTP_PASS` อยู่แล้วและไม่ต้องการเปลี่ยนค่า สามารถไม่ export `SMTP_PASS_VALUE` ได้ โดยสคริปต์จะ reuse ค่าเดิมให้
- `AI_LOCATION=us-central1` เป็นค่าที่แนะนำในระบบปัจจุบันเพื่อให้สอดคล้องกับ AI routes ที่ใช้งานจริง
- `AI_DAILY_TOKEN_LIMIT` ใช้กำหนดเพดาน token ต่อ user ต่อวัน
- `AI_USAGE_RETENTION_DAYS` ใช้กำหนดว่าจะเก็บเอกสาร usage รายวันใน Firestore ไว้กี่วันก่อน TTL ลบออก
- ไม่ควรปล่อย `localhost` หรือ origin ชั่วคราวค้างใน production โดยไม่จำเป็น
- ควรใส่ `Authorised redirect URI` ใน Google OAuth client ให้ตรงกับ callback URL ที่ใช้งานจริงแบบ exact match
- ถ้าใช้ BFF production flow ต้องเพิ่ม frontend callback เช่น `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/callback`
- ถ้ายังต้องการรองรับ legacy/direct mode ค่อยเพิ่ม backend callback `https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback` แยกอีกตัว
- ถ้าจะเปิด `TRUSTED_BFF_AUTH_ENABLED=true` ควรสร้าง shared secret แบบสุ่มยาวและเก็บเฉพาะใน Secret Manager เท่านั้น

## Optional Deploy Flags

ค่าพวกนี้ไม่จำเป็นสำหรับ production ปกติ แต่ `deploy.sh` รองรับและอาจมีประโยชน์ในบางรอบ deploy:

```bash
export CLOUD_RUN_INGRESS="all"
export CLOUD_RUN_AUTH_MODE="private"
export POST_DEPLOY_HEALTHCHECK_ENABLED="false"
export POST_DEPLOY_HEALTHCHECK_PATH="/healthz"
```

หมายเหตุ:

- `CLOUD_RUN_INGRESS` รองรับ `all`, `internal`, และ `internal-and-cloud-load-balancing`
- `CLOUD_RUN_AUTH_MODE` รองรับ `public` และ `private`
- `POST_DEPLOY_HEALTHCHECK_ENABLED=true` จะให้สคริปต์ยิง smoke check หลัง deploy
- ถ้า backend เป็น `private` สคริปต์จะข้าม signed URL smoke check แบบ public ให้อัตโนมัติ
- production path ปัจจุบันยังใช้ `run.app` โดยตรง แต่ backend ควรอยู่หลัง frontend BFF เมื่อพร้อม

## Copy/Paste Deploy Snippets

production แบบคัดลอกไปวางรันได้ทันที:

```bash
cd /Users/pst./senior/backend && \
APP_NAME="ai-formcheck" \
SERVICE_NAME="ai-formcheck-backend" \
FRONTEND_SERVICE_NAME="ai-formcheck-frontend" \
FRONTEND_SERVICE_ACCOUNT_NAME="ai-formcheck-frontend-sa" \
FRONTEND_URL="https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app" \
FRONTEND_EXTRA_URLS="" \
CLOUD_RUN_AUTH_MODE="private" \
TRUST_PROXY_BROWSER_ORIGIN_HEADER="true" \
BROWSER_ORIGIN_HEADER_NAME="x-browser-origin" \
TECH_SUPPORT_TARGET_EMAIL="support@example.com" \
SMTP_HOST_VALUE="smtp.example.com" \
SMTP_PORT="465" \
SMTP_SECURE="true" \
SMTP_USER_VALUE="no-reply@example.com" \
SMTP_FROM_EMAIL_VALUE="no-reply@example.com" \
SMTP_FROM_NAME_VALUE="AI FormCheck Support" \
SMTP_PASS_VALUE="your-smtp-password" \
OIDC_ENABLED="true" \
OIDC_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th" \
OIDC_REQUIRE_HOSTED_DOMAIN="true" \
AI_LOCATION="us-central1" \
AI_DAILY_TOKEN_LIMIT="50000" \
AI_USAGE_RETENTION_DAYS="30" \
GOOGLE_OIDC_CLIENT_ID_VALUE="your-google-client-id" \
GOOGLE_OIDC_CLIENT_SECRET_VALUE="your-google-client-secret" \
GOOGLE_OIDC_CALLBACK_URL="https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback" \
TRUSTED_BFF_AUTH_ENABLED="true" \
TRUSTED_BFF_AUTH_HEADER_NAME="x-bff-auth" \
TRUSTED_BFF_SHARED_SECRET_VALUE="your-bff-shared-secret" \
./deploy.sh
```

QA ชั่วคราวสำหรับ localhost:

```bash
cd /Users/pst./senior/backend && \
APP_NAME="ai-formcheck" \
SERVICE_NAME="ai-formcheck-backend" \
FRONTEND_SERVICE_NAME="ai-formcheck-frontend" \
FRONTEND_SERVICE_ACCOUNT_NAME="ai-formcheck-frontend-sa" \
FRONTEND_URL="https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app" \
FRONTEND_EXTRA_URLS="http://localhost:5173|http://127.0.0.1:5500" \
CLOUD_RUN_AUTH_MODE="private" \
TRUST_PROXY_BROWSER_ORIGIN_HEADER="true" \
BROWSER_ORIGIN_HEADER_NAME="x-browser-origin" \
TECH_SUPPORT_TARGET_EMAIL="support@example.com" \
SMTP_HOST_VALUE="smtp.example.com" \
SMTP_PORT="465" \
SMTP_SECURE="true" \
SMTP_USER_VALUE="no-reply@example.com" \
SMTP_FROM_EMAIL_VALUE="no-reply@example.com" \
SMTP_FROM_NAME_VALUE="AI FormCheck Support" \
SMTP_PASS_VALUE="your-smtp-password" \
OIDC_ENABLED="true" \
OIDC_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th" \
OIDC_REQUIRE_HOSTED_DOMAIN="true" \
AI_LOCATION="us-central1" \
AI_DAILY_TOKEN_LIMIT="50000" \
AI_USAGE_RETENTION_DAYS="30" \
GOOGLE_OIDC_CLIENT_ID_VALUE="your-google-client-id" \
GOOGLE_OIDC_CLIENT_SECRET_VALUE="your-google-client-secret" \
GOOGLE_OIDC_CALLBACK_URL="https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback" \
TRUSTED_BFF_AUTH_ENABLED="true" \
TRUSTED_BFF_AUTH_HEADER_NAME="x-bff-auth" \
TRUSTED_BFF_SHARED_SECRET_VALUE="your-bff-shared-secret" \
./deploy.sh
```

## Deploy

```bash
cd /Users/pst./senior/backend
./deploy.sh
```

สคริปต์จะ:

- deploy Cloud Run service
- update SMTP and OIDC secrets in Secret Manager
- inject production env vars
- ensure Firestore database ที่ app ใช้งานมีอยู่จริง
- ensure Firestore TTL policies สำหรับ `used_nonces.expire_at`, `RATE_LIMITS.expireAt`, และ `AI_USAGE_DAILY.expire_at`
- keep cleanup service/scheduler flow เดิม
- ไม่สร้าง domain mapping หรือ LB resources ระหว่าง deploy

หมายเหตุ:

- `deploy.sh` ตอนนี้ไม่รอให้ runtime ไปสร้าง Firestore เอง แต่จะเช็ก/สร้าง `FIRESTORE_DATABASE_ID` ให้ก่อน deploy
- `Cloud Run service` และ `Cloud Storage bucket` ถ้ายังไม่มี สคริปต์จะสร้างให้
- Firestore TTL เป็น eventual rollout ของ Google Cloud หลังเปิด policy แล้ว เอกสาร/สถานะอาจใช้เวลาสักพักกว่าจะสะท้อนครบ
- ระหว่าง step TTL อาจเห็น log ลักษณะ `Waiting for operation ... to complete...` ต่อเนื่องเป็นช่วงสั้น ๆ ซึ่งเป็นพฤติกรรมปกติของ `gcloud firestore fields ttls update` ไม่ได้แปลว่าสคริปต์ค้าง
- ถ้า deploy ต้องการ input ระหว่างรัน แปลว่ายังมีค่า config บางตัวไม่ได้ export และไม่ได้มีค่าเดิมใน Secret Manager โดยเฉพาะชุด SMTP/OIDC

ตัวอย่างเพิ่ม dev local ชั่วคราว:

```bash
export FRONTEND_URL="https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app"
export FRONTEND_EXTRA_URLS="http://localhost:5173|http://127.0.0.1:5500"
```

แนวทางที่แนะนำ:

- production ปกติให้ใช้ `FRONTEND_URL=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app` หรือ custom domain ของ frontend จริง
- ใช้ `FRONTEND_EXTRA_URLS` เฉพาะตอนที่ต้องทดสอบ local จริง
- เมื่อลง production รอบจริง ควรลบ dev origins ออกจากค่า deploy

## Viewing AI Usage In Firestore

ตอนนี้ AI usage ถูกเก็บไว้ใน collection `AI_USAGE_DAILY`

หมายเหตุ:

- ตอนนี้ไม่มี admin report endpoint สำหรับ AI usage แล้ว
- แนวทางที่ตั้งใจคือเปิดดูข้อมูลตรงจาก Firestore Console หรือ export ไปวิเคราะห์ต่อ

field สำคัญที่ใช้ดูเร็ว ๆ:

- `date_key` วันที่ของ usage เช่น `2026-03-27`
- `email` ผู้ใช้ที่ login ผ่าน OIDC
- `session_id` fallback กรณียังไม่มี email
- `request_count` จำนวนครั้งที่ยิง AI route วันนั้น
- `success_count` จำนวนครั้งที่สำเร็จ
- `failure_count` จำนวนครั้งที่ล้มเหลว
- `total_tokens` token รวมของวันนั้น
- `prompt_tokens` token ฝั่ง prompt
- `candidate_tokens` token ฝั่ง response
- `degree_levels` ระดับการศึกษาที่พบในวันนั้น
- `form_codes` ฟอร์มที่เกี่ยวข้องในวันนั้น
- `sub_types` ประเภทย่อยที่พบ
- `case_keys` case rule ที่พบ
- `route` route ล่าสุดที่บันทึก
- `model` model ล่าสุดที่ใช้
- `last_status` สถานะล่าสุด (`success` หรือ `failure`)
- `last_failure_reason` สาเหตุล่าสุดถ้าล้มเหลว
- `last_used_at` เวลาที่ใช้ล่าสุด
- `expire_at` วันที่ TTL จะลบเอกสารนี้

วิธีดูให้เร็วที่สุดใน Firestore Console:

1. เปิด collection `AI_USAGE_DAILY`
2. filter `date_key == "<วันที่ที่ต้องการ>"` ก่อน
3. sort ด้วย `total_tokens desc` ถ้าต้องการดู heavy users
4. sort ด้วย `failure_count desc` ถ้าต้องการหา user/flow ที่มีปัญหา
5. มอง `form_codes` และ `degree_levels` เพื่อดูว่า usage ไปหนักที่ฟอร์มหรือกลุ่มไหน

ถ้าจะวิเคราะห์หลายวันหรือทำ chart:

- Firestore Console เหมาะกับการ inspect รายวัน
- ถ้าต้องการ trend, dashboard, หรือ cohort analysis แนะนำ export ไป BigQuery หรือดึงออกไปประมวลผลต่อ

## Production Path: run.app

production path ปัจจุบันคือ `run.app` โดยตรง:

- เปิด `run.app` URL ของ Cloud Run โดยยึด canonical URL นี้เป็นหลัก:
  - `https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app`
- ไม่สร้าง domain mapping
- ไม่สร้างหรือแก้ LB resources ผ่าน deploy หลัก

ข้อควรทราบ:

- path นี้ practical แต่ยังเป็น `cross-origin` ถ้า frontend อยู่คนละ origin เช่น `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app`
- security ยังพอรับได้ถ้า OIDC/session/domain checks เข้ม
- แต่ defense-in-depth จะน้อยกว่าระบบเดิมที่มี `LB + IAP`

## One-Shot Deploy In `deploy.sh`

ถ้าต้องการรัน flow หลักในคำสั่งเดียว ใช้ `deploy.sh` ได้เลย:

```bash
cd /Users/pst./senior/backend
./deploy.sh
```

สคริปต์นี้จะทำตามลำดับ:

1. deploy backend เวอร์ชัน OIDC-only
2. เปิด `run.app` URL ของ Cloud Run
3. ไม่แตะ domain mapping หรือ LB resources ใน deploy path หลัก

เพื่อหลีกเลี่ยงความสับสนจาก Cloud Run ที่อาจมีทั้ง deterministic URL และ legacy hash URL:

- ให้ยึด canonical URL นี้เป็นหลักในการตั้ง OAuth callback:
  - `https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback`
- `deploy.sh` จะตั้ง `GOOGLE_OIDC_CALLBACK_URL` ให้เป็นค่านี้อัตโนมัติถ้าคุณไม่ override เอง
- ถึงแม้ Cloud Run service เดียวกันอาจมี legacy hash URL แสดงอยู่บางจุด ให้ใช้ regional URL นี้เป็น source of truth สำหรับ OAuth callback และเอกสารปัจจุบัน
- ใน Google OAuth client ควรใส่ redirect URI ตัวนี้อย่างน้อย 1 รายการ

## Authentication Flow After Deploy

1. ผู้ใช้เปิด `GET /api/v1/oidc/google/login?return_to=<frontend-url>`
2. Google login สำเร็จ
3. backend callback verify identity
4. backend ตั้ง `sci_session_token`
5. frontend เรียก `GET /api/v1/oidc/me`
6. frontend เรียก `GET /api/v1/auth/csrf-token`
7. frontend เรียก `POST /api/v1/session/init` และ endpoint อื่น

## Verification Checklist

หลัง deploy ควรเช็ก:

1. `GET /api/v1/system/status`
   endpoint นี้ตั้งใจให้เป็น public liveness check แบบ minimal ไม่เผย runtime/config ภายในเกินจำเป็น
2. `GET /api/v1/system/status/details`
   ใช้หลัง login แล้วสำหรับ internal QA/ops เมื่อต้องเช็ก runtime/config เชิงลึก
3. `GET /api/v1/auth/public-key`
4. เปิด `GET /api/v1/oidc/google/login?return_to=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app`
5. หลังกลับมาให้ `GET /api/v1/oidc/me`
6. `GET /api/v1/auth/csrf-token`
7. `POST /api/v1/session/init`

## Separate Audit/Cleanup Scripts

เช็ก resource เก่าที่อาจไม่ใช้แล้ว:

```bash
cd /Users/pst./senior/backend
./audit-legacy-resources.sh
```

ลบ resource เก่าเมื่อมั่นใจแล้ว:

```bash
cd /Users/pst./senior/backend
DELETE_LEGACY_LB="true" ./cleanup-legacy-resources.sh
```

## Notes

- สคริปต์นี้ไม่ใช้ `IAP` เป็น auth gate แล้ว
- `deploy.sh` ตอนนี้ใช้ `run.app` โดยตรงเสมอ
- ถ้าต้อง audit หรือล้าง legacy LB ให้ใช้สคริปต์แยก
- custom domain / certificate ควรจัดการแยกตาม infra ที่ใช้งานจริง
- ถ้าจะเปลี่ยนโดเมน Chula หรือเปลี่ยน CA ระดับมหาวิทยาลัย ส่วนใหญ่จะกระทบ DNS / certificate / callback URL มากกว่า code
