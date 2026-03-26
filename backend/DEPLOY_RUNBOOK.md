# Deploy Runbook

Last updated: `2026-03-26`

runbook นี้อธิบายการ deploy backend ในโหมด Google OIDC แบบไม่ใช้ IAP/LB auth gate โดยให้ `run.app` เป็น entrypoint หลัก

หมายเหตุสำคัญ:

- production path ที่แนะนำตอนนี้คือ Cloud Run `run.app` URL แบบ regional โดยตรง
- `deploy.sh` ตอนนี้ deploy ไปที่ `run.app` เสมอ
- domain mapping, LB fallback, และ legacy LB cleanup ถูกแยกออกจาก deploy หลักแล้ว

## Prerequisites

- มีสิทธิ์ใช้ Cloud Run, Cloud Build, Secret Manager, Storage, IAM, Scheduler
- มีสิทธิ์ใช้ Firestore database/TTL administration
- มี Google OAuth client สำหรับ web application
- มี Google OAuth client สำหรับ backend ตัวนี้

## Auto Bootstrap By `deploy.sh`

สิ่งที่ `deploy.sh` จัดการให้เองในฝั่ง Google Cloud:

- enable APIs ที่ใช้ใน deployment/runtime เช่น Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, Storage, IAM, Cloud Scheduler
- enable APIs ที่ใช้กับ signed URL และ service-account-based signing เช่น IAM Credentials API
- create/update Cloud Run service หลัก
- create bucket ถ้ายังไม่มี
- apply bucket lifecycle policy ถ้าเปิด flag ที่เกี่ยวข้อง
- create/check Firestore database ที่ app ใช้งาน
- enable Firestore TTL policies สำหรับ `used_nonces.expire_at` และ `RATE_LIMITS.expireAt`
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
- ใส่ Authorized redirect URI ให้ตรงกับ backend callback URL แบบ exact match
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
- `GOOGLE_OIDC_CALLBACK_URL=https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback` (optional; ถ้าไม่ตั้ง `deploy.sh` จะ default เป็น canonical Cloud Run URL นี้ให้อัตโนมัติ)

หมายเหตุ:

- ถ้า Secret Manager มี `GOOGLE_OIDC_CLIENT_ID` และ `GOOGLE_OIDC_CLIENT_SECRET` อยู่แล้ว สคริปต์จะพยายาม reuse ให้อัตโนมัติก่อน prompt
- ค่า `GOOGLE_OIDC_CLIENT_ID_VALUE` และ `GOOGLE_OIDC_CLIENT_SECRET_VALUE` จึงจำเป็นเฉพาะตอน bootstrap ครั้งแรกหรือเมื่อต้องการอัปเดต secret

## Recommended Production Config

```bash
export FRONTEND_URL="https://pstpyst.com"
export FRONTEND_EXTRA_URLS=""
export OIDC_ENABLED="true"
export OIDC_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
export OIDC_REQUIRE_HOSTED_DOMAIN="true"
export AI_LOCATION="us-central1"
export GOOGLE_OIDC_CLIENT_ID_VALUE="your-google-client-id"
export GOOGLE_OIDC_CLIENT_SECRET_VALUE="your-google-client-secret"
export GOOGLE_OIDC_CALLBACK_URL="https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback"
```

หมายเหตุ:

- `FRONTEND_URL` ควรเป็น production origin หลักเพียงค่าเดียว
- `FRONTEND_EXTRA_URLS` เป็น optional override สำหรับ dev/QA origins เท่านั้น
- `AI_LOCATION=us-central1` เป็นค่าที่แนะนำในระบบปัจจุบันเพื่อให้สอดคล้องกับ AI routes ที่ใช้งานจริง
- ไม่ควรปล่อย `localhost` หรือ origin ชั่วคราวค้างใน production โดยไม่จำเป็น
- ควรใส่ `Authorised redirect URI` ใน Google OAuth client ให้ตรงกับ callback URL ข้างต้นแบบ exact match

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
- ensure Firestore TTL policies สำหรับ `used_nonces.expire_at` และ `RATE_LIMITS.expireAt`
- keep cleanup service/scheduler flow เดิม
- ไม่สร้าง domain mapping หรือ LB resources ระหว่าง deploy

หมายเหตุ:

- `deploy.sh` ตอนนี้ไม่รอให้ runtime ไปสร้าง Firestore เอง แต่จะเช็ก/สร้าง `FIRESTORE_DATABASE_ID` ให้ก่อน deploy
- `Cloud Run service` และ `Cloud Storage bucket` ถ้ายังไม่มี สคริปต์จะสร้างให้
- Firestore TTL เป็น eventual rollout ของ Google Cloud หลังเปิด policy แล้ว เอกสาร/สถานะอาจใช้เวลาสักพักกว่าจะสะท้อนครบ

ตัวอย่างเพิ่ม dev local ชั่วคราว:

```bash
export FRONTEND_URL="https://pstpyst.com"
export FRONTEND_EXTRA_URLS="http://localhost:5173|http://127.0.0.1:5500"
```

แนวทางที่แนะนำ:

- production ปกติให้ใช้ `FRONTEND_URL=https://pstpyst.com`
- ใช้ `FRONTEND_EXTRA_URLS` เฉพาะตอนที่ต้องทดสอบ local จริง
- เมื่อลง production รอบจริง ควรลบ dev origins ออกจากค่า deploy

## Production Path: run.app

production path ปัจจุบันคือ `run.app` โดยตรง:

- เปิด `run.app` URL ของ Cloud Run โดยยึด canonical URL นี้เป็นหลัก:
  - `https://sci-request-system-466086429766.asia-southeast3.run.app`
- ไม่สร้าง domain mapping
- ไม่สร้างหรือแก้ LB resources ผ่าน deploy หลัก

ข้อควรทราบ:

- path นี้ practical แต่ยังเป็น `cross-origin` ถ้า frontend อยู่ที่ `pstpyst.com`
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
  - `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback`
- `deploy.sh` จะตั้ง `GOOGLE_OIDC_CALLBACK_URL` ให้เป็นค่านี้อัตโนมัติถ้าคุณไม่ override เอง
- ถึงแม้ Cloud Run service เดียวกันอาจมี legacy hash URL แสดงอยู่บางจุด ให้ใช้ regional URL นี้เป็น source of truth สำหรับ OAuth callback และเอกสารปัจจุบัน
- ใน Google OAuth client ควรใส่ redirect URI ตัวนี้อย่างน้อย 1 รายการ

## Authentication Flow After Deploy

1. ผู้ใช้เปิด `GET /api/v1/oidc/google/login?return_to=<frontend-url>`
2. Google login สำเร็จ
3. backend callback verify identity
4. backend ตั้ง `sci_session_token`
5. frontend เรียก `GET /api/v1/oidc/me`
6. frontend เรียก `POST /api/v1/session/init` และ endpoint อื่น

## Verification Checklist

หลัง deploy ควรเช็ก:

1. `GET /api/v1/system/status`
   endpoint นี้ตั้งใจให้เป็น public liveness check แบบ minimal ไม่เผย runtime/config ภายในเกินจำเป็น
2. `GET /api/v1/system/status/details`
   ใช้หลัง login แล้วสำหรับ internal QA/ops เมื่อต้องเช็ก runtime/config เชิงลึก
3. `GET /api/v1/auth/public-key`
4. เปิด `GET /api/v1/oidc/google/login?return_to=https://pstpyst.com`
5. หลังกลับมาให้ `GET /api/v1/oidc/me`
6. `POST /api/v1/session/init`

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
