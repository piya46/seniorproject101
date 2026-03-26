# Deploy Runbook

Last updated: `2026-03-26`

runbook นี้อธิบายการ deploy backend ในโหมด Google OIDC แบบไม่ใช้ IAP/LB auth gate โดยให้ `run.app` เป็น entrypoint หลัก

หมายเหตุสำคัญ:

- production path ที่แนะนำตอนนี้คือ Cloud Run `run.app` URL แบบ regional โดยตรง
- `deploy.sh` ตอนนี้ deploy ไปที่ `run.app` เสมอ
- domain mapping, LB fallback, และ legacy LB cleanup ถูกแยกออกจาก deploy หลักแล้ว

## Prerequisites

- มีสิทธิ์ใช้ Cloud Run, Cloud Build, Secret Manager, Storage, IAM, Scheduler
- มี Google OAuth client สำหรับ web application
- มี Google OAuth client สำหรับ backend ตัวนี้

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
- keep cleanup service/scheduler flow เดิม
- ไม่สร้าง domain mapping หรือ LB resources ระหว่าง deploy

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
2. `GET /api/v1/auth/public-key`
3. เปิด `GET /api/v1/oidc/google/login?return_to=https://pstpyst.com`
4. หลังกลับมาให้ `GET /api/v1/oidc/me`
5. `POST /api/v1/session/init`

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
