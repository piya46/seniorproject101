# Postman Guide

Version: `v1.10.0`
Last updated: `2026-04-04`

โฟลเดอร์นี้เป็นชุดเอกสารและ collection สำหรับ backend ในโหมด Google OIDC แบบไม่ใช้ IAP

ไฟล์สำคัญ:

- `Sci-Request-System.postman_collection.json`
- `Sci-Request-System.local.postman_environment.json`
- `Sci-Request-System.staging.postman_environment.json`
- `Sci-Request-System.production.postman_environment.json`
- `FRONTEND_INTEGRATION_GUIDE.md`
- `printable-api-docs.html`
- `../API_DOCUMENTATION.md`
- `../API_EXAMPLES.md`
- `../SECURITY_OVERVIEW.md`

## Base URLs

- Local: `http://localhost:8080/api/v1`
- Production: `https://ai-formcheck-backend-499335698145.asia-southeast3.run.app/api/v1`
- Canonical OAuth callback: `https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback`

Environment files ตอนนี้มีตัวแปรช่วยเพิ่ม:

- `backendBaseOrigin`
- `frontendBaseOrigin`
- `frontendAuthCallbackUrl`
- `legacyOidcCallbackUrl`
- `returnToUrl`

หมายเหตุ:

- `Sci-Request-System.production.postman_environment.json` ถูกอัปเดตให้ชี้ production `run.app` ปัจจุบันแล้ว
- `Sci-Request-System.staging.postman_environment.json` ยังเป็น placeholder ของทีม และต้องแก้ก่อนใช้งานจริงเสมอ

## Production Auth Flow

production target ใหม่:

1. browser เรียก frontend BFF
2. frontend BFF เป็น owner ของ browser-facing login/session flow
3. browser เปิด `/auth/login` ที่ frontend
4. frontend BFF เรียก backend `GET /oidc/bff/google/login-url` และ `GET /oidc/bff/google/callback`
5. frontend BFF เรียก backend private แบบ server-to-server ตาม [../BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)

legacy/direct mode ที่ยังคงอยู่เพื่อ backward compatibility:

1. เปิด `GET /oidc/google/login?return_to=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app`
2. login ผ่าน Google
3. backend callback ตั้ง session cookie
4. เรียก `GET /oidc/me`
5. ถ้าต้อง bind ข้อมูลส่วนตัวลง UI ให้เรียก `GET /profile/me`
6. ถ้าต้องอ่านข้อมูลส่วนตัวระดับเข้มขึ้น ให้เรียก `POST /profile/details` แบบ secure JSON
7. เรียก `GET /auth/csrf-token`
8. ค่อยเรียก `POST /session/init` และ endpoint อื่น

## Collection Notes

- collection-level scripts ยังช่วยเรื่อง secure JSON transport ให้เหมือนเดิม
- ถ้าเปิด `PFS_V2_ENABLED=true` client/tooling สามารถใช้ `GET /api/v2/auth/handshake` และส่ง secure JSON envelope แบบ `v2` ได้
- state-changing requests ที่ใช้ session cookie ต้องมี `x-csrf-token`
- `ALLOW_BEARER_SESSION_TOKEN` ควรคงเป็น `false` ใน production
- business body ยังต้องถูกเข้ารหัสสำหรับ secure JSON endpoints
- `GET` endpoints และ multipart upload ไม่ใช้ secure JSON wrapper
- status endpoints ตอนนี้แยกเป็น `GET /system/status`, `GET /system/status/storage-signing`, และ `GET /system/status/details`
- `GET /system/status/storage-signing` ตอนนี้เป็น authenticated probe แล้ว ไม่ใช่ public smoke probe
- `GET /chat/usage` ใช้ดึง AI usage summary สำหรับ chat quota widget หรือ status indicator ฝั่ง frontend
- BFF production flow ใช้ frontend callback `/auth/callback`; backend callback `/oidc/google/callback` เป็น legacy/direct mode เป็นหลัก
- `POST /oidc/logout` ตอนนี้จะ revoke session record, ล้าง cookie และส่ง `Clear-Site-Data: "cache", "cookies", "storage"` ใน browser ที่รองรับ
- response ที่ผ่าน authenticated middleware จะถูกตั้ง `Cache-Control: private, no-store, max-age=0, must-revalidate` เพิ่มอีกชั้น จึงไม่ควรพึ่ง browser cache สำหรับ backend auth data
- `POST /documents/merge` ตอบ `202 queued`; client ต้อง poll `/documents/jobs/:jobId`, เรียก `/documents/jobs/:jobId/download` เพื่อรับ `download_path`, แล้วค่อยเปิด `/documents/jobs/:jobId/file`
- `POST /upload` ตอบ `200 success` เพื่อ stage ไฟล์ไว้ก่อน; ถ้า validation ต้องเตรียมเอกสารเพิ่ม client จะ poll `/upload/jobs/:jobId`
- `POST /documents/merge` และ `POST /upload` ยังอาจตอบ `413` เมื่อชน policy ขนาดไฟล์/ขนาดรวม
- trusted BFF flow ตอนนี้ harden เพิ่มได้ด้วย `TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN=true` และ `x-bff-identity-token`

## AI Usage Notes

- backend เก็บ AI usage รายวันไว้ใน Firestore collection `AI_USAGE_DAILY`
- retention ของข้อมูลนี้คุมผ่าน env `AI_USAGE_RETENTION_DAYS`
- ตอนนี้ไม่มี admin report endpoint สำหรับ usage และแนวทางคือเปิดดูตรงใน Firestore Console

## Useful Commands

```bash
npm run docs:postman:bump -- vX.Y.Z
npm run docs:postman:validate
npm run docs:api:printable
```

Recommended update flow:

```bash
cd /Users/pst./senior/backend
npm run docs:postman:bump -- vX.Y.Z
npm run docs:postman:validate
npm run docs:api:printable
```
