# API Documentation

Version: `v1.9.4`
Last updated: `2026-03-27`

เอกสารนี้เป็น API contract กลางของ backend โดยอธิบาย endpoint, auth, encryption และ error model แบบไม่ผูกกับภาษา client

เอกสารที่เกี่ยวข้อง:

- [API_EXAMPLES.md](/Users/pst./senior/backend/API_EXAMPLES.md)
- [SECURITY_OVERVIEW.md](/Users/pst./senior/backend/SECURITY_OVERVIEW.md)
- [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)
- [backend/postman/README.md](/Users/pst./senior/backend/postman/README.md)
- [backend/postman/FRONTEND_INTEGRATION_GUIDE.md](/Users/pst./senior/backend/postman/FRONTEND_INTEGRATION_GUIDE.md)

## Overview

- Base URL: `/api/v1`
- Authentication: Google OIDC login + app session cookie (`sci_session_token`)
- Allowed account domains: กำหนดผ่าน `OIDC_ALLOWED_DOMAINS`
- Hosted domain enforcement: กำหนดผ่าน `OIDC_REQUIRE_HOSTED_DOMAIN`
- Secure JSON endpoints ใช้ application-level encryption transport
- `GET /api/v1/system/status` ใช้เป็น public liveness endpoint หลัก
- `GET /api/v1/system/status/storage-signing` ใช้เป็น public smoke probe สำหรับ signed URL capability
- `GET /api/v1/system/status/details` ใช้เป็น authenticated detailed status endpoint สำหรับ internal QA/ops

## Security Posture Summary

- ใช้ Google OIDC เป็น identity provider
- backend verify Google `id_token`, `state`, `nonce`, `email_verified`, และ allowed domains
- backend ออก session cookie แบบ `HttpOnly` และ `Secure` ใน production
- backend ออก anti-CSRF token ผ่าน `sci_csrf_token` + `x-csrf-token` สำหรับ state-changing requests ที่ใช้ session cookie
- backend regenerate `session_id` ใหม่หลัง OIDC login callback
- `POST /oidc/logout` จะลบทั้ง cookie และ session record ฝั่ง server และจะรับเฉพาะ browser origin ที่อยู่ใน frontend allowlist
- endpoint ธุรกิจหลักยังต้องผ่าน session-based auth
- secure JSON encryption layer เดิมยังอยู่สำหรับ `POST` JSON ที่กำหนด

## Authentication Flow

flow ที่แนะนำ:

1. frontend หรือ browser เปิด `GET /oidc/google/login?return_to=<frontend-url>`
2. Google login เสร็จแล้ว redirect กลับ `GET /oidc/google/callback`
3. backend verify Google identity และสร้าง `sci_session_token`
4. backend redirect กลับ frontend พร้อม `auth=ok` และ `oidc=done`
5. frontend เรียก `GET /oidc/me` ด้วย `credentials: 'include'`
6. frontend เรียก `GET /auth/csrf-token`
7. จากนั้นค่อยเรียก `POST /session/init` และ endpoint อื่น

ข้อสำคัญ:

- ไม่ส่ง token หรือ email ผ่าน query string
- `return_to` ต้องอยู่ใน frontend allowlist ของระบบ
  production ควรใช้ `FRONTEND_URL` เป็นหลัก
  และใช้ `FRONTEND_EXTRA_URLS` เป็น temporary dev/QA override เท่านั้น
- Google OAuth callback ควรยึด exact URI นี้เป็นหลัก:
  `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback`
- `POST /session/init` ตอนนี้ต้องมี OIDC-backed session ก่อนแล้ว
- state-changing requests ที่ใช้ session cookie ต้องแนบ `x-csrf-token` ให้ตรงกับ token ปัจจุบัน

## Endpoint Matrix

| Endpoint | Method | ต้อง Auth | ต้อง Encryption | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `/api/v1/system/status` | `GET` | ไม่ต้อง | ไม่ต้อง | service liveness + high-level check status |
| `/api/v1/system/status/storage-signing` | `GET` | ไม่ต้อง | ไม่ต้อง | smoke probe สำหรับตรวจว่า runtime ยังสร้าง signed URL ได้ |
| `/api/v1/system/status/details` | `GET` | ต้อง | ไม่ต้อง | detailed runtime/config status สำหรับ internal QA/ops |
| `/auth/public-key` | `GET` | ไม่ต้อง | ไม่ต้อง | public key สำหรับ secure JSON |
| `/auth/csrf-token` | `GET` | ต้อง | ไม่ต้อง | ดึง/refresh anti-CSRF token สำหรับ browser client |
| `/oidc/google/login` | `GET` | ไม่ต้อง | ไม่ต้อง | เริ่ม Google OIDC login |
| `/oidc/google/callback` | `GET` | ไม่ต้อง | ไม่ต้อง | backend callback หลัง Google login |
| `/oidc/me` | `GET` | ต้อง | ไม่ต้อง | อ่านสถานะ session และ identity ปัจจุบัน |
| `/oidc/logout` | `POST` | ไม่ต้อง | ไม่ต้อง | ลบ app session cookie และ revoke session record |
| `/session/init` | `POST` | ต้อง | ต้อง | bootstrap secure JSON flow/reuse session |
| `/departments` | `GET` | ต้อง | ไม่ต้อง | โหลด metadata คณะ/ภาควิชา |
| `/forms` | `GET` | ต้อง | ไม่ต้อง | โหลดรายการฟอร์ม |
| `/forms/:form_code` | `GET` | ต้อง | ไม่ต้อง | โหลดรายละเอียดฟอร์ม |
| `/upload` | `POST multipart/form-data` | ต้อง | ไม่ใช้ secure JSON wrapper | อัปโหลดไฟล์ |
| `/validation/check-completeness` | `POST` | ต้อง | ต้อง | ตรวจเอกสาร |
| `/documents/merge` | `POST` | ต้อง | ต้อง | รวมเอกสาร |
| `/chat/recommend` | `POST` | ต้อง | ต้อง | แนะนำฟอร์ม/ตอบคำถาม |
| `/support/technical-email` | `POST multipart/form-data` | ต้อง | ไม่ใช้ secure JSON wrapper | ส่งอีเมลแจ้งปัญหา |

## OIDC Endpoints

### `GET /oidc/google/login`

ใช้เริ่ม Google OIDC login

query:

- `return_to` optional แต่แนะนำให้ส่ง

เงื่อนไข:

- `return_to` ต้อง match origin ที่อยู่ใน frontend allowlist
  โดย `FRONTEND_URL` ควรเป็น production origin หลัก
  และ `FRONTEND_EXTRA_URLS` ควรใช้เป็น temporary dev/QA override เท่านั้น
- backend จะสร้าง signed state และ nonce ก่อน redirect ไป Google

### `GET /oidc/google/callback`

route callback ที่ Google redirect กลับมา

backend จะ:

- exchange authorization code
- verify `id_token`
- ตรวจ `email_verified`
- ตรวจ email domain และ hosted domain
- สร้าง `sci_session_token` ใหม่สำหรับ authenticated app session
- redirect กลับ `return_to` พร้อม `auth=ok` และ `oidc=done`

### `GET /oidc/me`

response ตัวอย่าง:

```json
{
  "authenticated": true,
  "email": "student@chula.ac.th",
  "hosted_domain": "student.chula.ac.th",
  "name": "Student Name",
  "picture": "https://...",
  "auth_provider": "google_oidc"
}
```

### `POST /oidc/logout`

ลบ `sci_session_token` และ revoke session record ฝั่ง server

เงื่อนไขเพิ่มเติม:

- request ต้องมาจาก browser origin ที่อยู่ใน frontend allowlist
- ต้องแนบ `x-csrf-token` ถ้าเรียกผ่าน session cookie จาก browser
- ใช้สำหรับทดสอบ negative-path ได้โดยเรียก `GET /oidc/me` ซ้ำหลัง logout

response ตัวอย่าง:

```json
{
  "status": "success",
  "message": "Logged out successfully."
}
```

## CSRF Token

### `GET /auth/csrf-token`

ใช้สำหรับดึงหรือ refresh anti-CSRF token หลัง login สำเร็จแล้ว

response ตัวอย่าง:

```json
{
  "csrf_token": "random-token-value"
}
```

หมายเหตุ:

- frontend ควรเรียก endpoint นี้หลัง `GET /oidc/me`
- token นี้ต้องถูกส่งกลับมาใน header `x-csrf-token`
- ใช้กับทุก `POST`, `PUT`, `PATCH`, `DELETE` ที่อาศัย `sci_session_token`

## Session Init

### `POST /session/init`

ใช้เริ่ม secure JSON flow หรือ reuse session record ของระบบ

ตอนนี้ endpoint นี้:

- ต้องมี OIDC-backed session ก่อน
- ต้องมี anti-CSRF token ก่อน
- ใช้ secure JSON transport
- จะคืน `session_id` ที่ผูกกับระบบภายใน

response ตัวอย่าง:

```json
{
  "message": "Session initialized",
  "session_id": "sess_abc123",
  "csrf_token": "random-token-value"
}
```

## Support Endpoint

### `POST /support/technical-email`

ข้อจำกัด:

- ต้องมี session cookie
- ต้องแนบ `x-csrf-token`
- ใช้ `multipart/form-data`
- แนบไฟล์ได้สูงสุด 1 ไฟล์
- ขนาดไฟล์ไม่เกิน 2MB
- รองรับ `jpg`, `png`, `webp`, `pdf`
- backend ตรวจ `Origin/Referer`
- backend รับ `multipart/form-data` เฉพาะ endpoint ที่ออกแบบไว้จริง เช่น `/upload` และ `/support/technical-email`
- multipart browser requests ต้องมาจาก frontend origin ที่อยู่ใน allowlist
- ปลายทางอีเมลกำหนดจาก `TECH_SUPPORT_TARGET_EMAIL`

## Error Model

รูปแบบกลาง:

```json
{
  "error": "ข้อความสรุป",
  "message": "รายละเอียดเพิ่มเติม"
}
```

status code ที่ client ควรรองรับ:

| Status | ความหมาย |
| --- | --- |
| `400` | request ไม่ถูกต้อง |
| `401` | ไม่มี session หรือ auth flow ไม่สมบูรณ์ |
| `403` | domain / hosted domain / policy ไม่ผ่าน |
| `404` | resource ไม่พบ |
| `429` | rate limit |
| `500` | backend internal failure |

## AI Usage Retention

- backend เก็บ AI usage รายวันไว้ใน Firestore collection `AI_USAGE_DAILY`
- ใช้ข้อมูลนี้ทั้งสำหรับ daily token limit และ usage analytics
- retention กำหนดผ่าน env `AI_USAGE_RETENTION_DAYS`
- TTL field ที่ใช้คือ `expire_at`

## Notes

- การเอา IAP ออกทำให้ชั้น outer access gate หายไป แต่ app-layer auth, domain enforcement, session policy, validation, encryption, และ rate limiting ยังอยู่
- production ตอนนี้ใช้ `run.app` โดยตรงเป็นหลัก จึงมี public origin ของ backend เพิ่มขึ้น แต่ไม่ได้เปลี่ยน app-layer auth contract
- ถ้าต้องการ OIDC หลาย provider ในอนาคต ควรแยก abstraction ออกจาก Google-specific logic ใน `utils/oidcUtils.js`
