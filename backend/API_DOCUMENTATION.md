# API Documentation

Version: `v1.9.7`
Last updated: `2026-03-31`

เอกสารนี้เป็น API contract กลางของ backend โดยอธิบาย endpoint, auth, encryption และ error model แบบไม่ผูกกับภาษา client

เอกสารที่เกี่ยวข้อง:

- [API_EXAMPLES.md](/Users/pst./senior/backend/API_EXAMPLES.md)
- [SECURITY_OVERVIEW.md](/Users/pst./senior/backend/SECURITY_OVERVIEW.md)
- [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)
- [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)
- [backend/postman/README.md](/Users/pst./senior/backend/postman/README.md)
- [backend/postman/FRONTEND_INTEGRATION_GUIDE.md](/Users/pst./senior/backend/postman/FRONTEND_INTEGRATION_GUIDE.md)

## Overview

- Base URL: `/api/v1`
- Authentication: session-backed auth with Google OIDC identity rules; production target ใหม่คือ frontend BFF + private backend
- Allowed account domains: กำหนดผ่าน `OIDC_ALLOWED_DOMAINS`
- Hosted domain enforcement: กำหนดผ่าน `OIDC_REQUIRE_HOSTED_DOMAIN`
- Secure JSON endpoints ใช้ application-level encryption transport
- `GET /api/v1/system/status` ใช้เป็น public liveness endpoint หลัก
- `GET /api/v1/system/status/storage-signing` ใช้เป็น authenticated smoke probe สำหรับ signed URL capability
- `GET /api/v1/system/status/details` ใช้เป็น authenticated detailed status endpoint สำหรับ internal QA/ops

## Security Posture Summary

- ใช้ Google OIDC เป็น identity provider
- backend verify Google `id_token`, `state`, `nonce`, `email_verified`, และ allowed domains
- backend ออก session cookie แบบ `HttpOnly` และ `Secure` ใน production
- production BFF mode ควรใช้ `COOKIE_SAME_SITE=Lax`, `COOKIE_SECURE=true`, และ `TRUST_PROXY=1`
- backend ออก anti-CSRF token ผ่าน `sci_csrf_token` + `x-csrf-token` สำหรับ state-changing requests ที่ใช้ session cookie
- backend regenerate `session_id` ใหม่หลัง OIDC login callback
- `POST /oidc/logout` จะลบทั้ง cookie และ session record ฝั่ง server และจะรับเฉพาะ browser origin ที่อยู่ใน frontend allowlist
- endpoint ธุรกิจหลักยังต้องผ่าน session-based auth
- secure JSON encryption layer เดิมยังอยู่สำหรับ `POST` JSON ที่กำหนด
- DB field encryption สำหรับข้อมูลใหม่ใช้ format แบบ versioned (`vN:iv:ciphertext:authTag`) และ backend ยังอ่าน legacy format เดิมได้

## Authentication Flow

flow ที่แนะนำสำหรับ production:

1. browser เรียก frontend BFF
2. frontend BFF เป็น owner ของ browser-facing login/session flow
3. frontend BFF เริ่ม browser-facing login ผ่าน `/auth/login`
4. Google redirect กลับ `GET /auth/callback` บน frontend
5. frontend BFF เรียก backend BFF bridge routes เพื่อให้ backend verify Google identity และออก `sci_session_token`
6. frontend BFF proxy request อื่นไป backend พร้อม cookie, CSRF, และ trusted BFF headers ตามที่จำเป็น

legacy/direct mode ที่ยังมีอยู่เพื่อ backward compatibility:

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
- ถ้าใช้ production BFF flow Google OAuth redirect URI ควรชี้มาที่ frontend callback:
  `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/callback`
- backend callback ด้านล่างยังใช้กับ legacy/direct mode เท่านั้น:
  `https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback`
- `POST /session/init` ตอนนี้ต้องมี OIDC-backed session ก่อนแล้ว
- state-changing requests ที่ใช้ session cookie ต้องแนบ `x-csrf-token` ให้ตรงกับ token ปัจจุบัน
- ถ้า deploy ด้วย `CLOUD_RUN_AUTH_MODE=private` route `GET /oidc/google/login` และ `GET /oidc/google/callback` จะถูก block เพื่อไม่ให้ direct browser flow ชนกับ private backend architecture

## Endpoint Matrix

| Endpoint | Method | ต้อง Auth | ต้อง Encryption | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `/api/v1/system/status` | `GET` | ไม่ต้อง | ไม่ต้อง | service liveness + high-level check status |
| `/api/v1/system/status/storage-signing` | `GET` | ต้อง | ไม่ต้อง | smoke probe สำหรับตรวจว่า runtime ยังสร้าง signed URL ได้ |
| `/api/v1/system/status/details` | `GET` | ต้อง | ไม่ต้อง | detailed runtime/config status สำหรับ internal QA/ops |
| `/auth/public-key` | `GET` | ไม่ต้อง | ไม่ต้อง | public key สำหรับ secure JSON |
| `/auth/csrf-token` | `GET` | ต้อง | ไม่ต้อง | ดึง/refresh anti-CSRF token สำหรับ browser client |
| `/oidc/google/login` | `GET` | ไม่ต้อง | ไม่ต้อง | เริ่ม Google OIDC login ใน legacy/direct mode |
| `/oidc/google/callback` | `GET` | ไม่ต้อง | ไม่ต้อง | backend callback หลัง Google login ใน legacy/direct mode |
| `/oidc/bff/google/login-url` | `GET` | ไม่ใช้ session แต่ต้อง trusted BFF header | ไม่ต้อง | ออก Google login URL สำหรับ frontend BFF flow |
| `/oidc/bff/google/callback` | `GET` | ไม่ใช้ session แต่ต้อง trusted BFF header | ไม่ต้อง | backend BFF callback bridge ที่ verify Google identity และออก session cookie |
| `/oidc/me` | `GET` | ต้อง | ไม่ต้อง | อ่านสถานะ session และ identity ปัจจุบัน |
| `/profile/me` | `GET` | ต้อง | ไม่ต้อง | อ่าน safe profile ที่พร้อม bind ลง UI |
| `/profile/details` | `POST` | ต้อง | ต้อง | อ่านข้อมูลส่วนตัวแบบเข้ารหัสผ่าน secure JSON |
| `/oidc/logout` | `POST` | ต้อง | ไม่ต้อง | ลบ app session cookie และ revoke session record |
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

ใช้เริ่ม Google OIDC login ใน legacy/direct mode

query:

- `return_to` optional แต่แนะนำให้ส่ง

เงื่อนไข:

- `return_to` ต้อง match origin ที่อยู่ใน frontend allowlist
  โดย `FRONTEND_URL` ควรเป็น production origin หลัก
  และ `FRONTEND_EXTRA_URLS` ควรใช้เป็น temporary dev/QA override เท่านั้น
- backend จะสร้าง signed state และ nonce ก่อน redirect ไป Google
- ถ้า backend อยู่ใน private BFF mode route นี้จะตอบ `409`

### `GET /oidc/google/callback`

route callback ที่ Google redirect กลับมาใน legacy/direct mode

backend จะ:

- exchange authorization code
- verify `id_token`
- ตรวจ `email_verified`
- ตรวจ email domain และ hosted domain
- สร้าง `sci_session_token` ใหม่สำหรับ authenticated app session
- redirect กลับ `return_to` พร้อม `auth=ok` และ `oidc=done`
- ถ้า backend อยู่ใน private BFF mode route นี้จะตอบ `409`

### `GET /oidc/bff/google/login-url`

ใช้โดย frontend BFF เท่านั้นเพื่อขอ Google login URL สำหรับ browser-facing BFF flow

query:

- `return_to` required ในทางปฏิบัติ และควรเป็น frontend public URL ที่ user ใช้งานจริง

เงื่อนไข:

- request ต้องผ่าน trusted BFF secret header
- route นี้ไม่ต้องมี session cookie ล่วงหน้า
- backend จะสร้าง signed state และ nonce เหมือน legacy flow แต่จะ override callback URL ไปที่ frontend `/auth/callback`

response ตัวอย่าง:

```json
{
  "login_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### `GET /oidc/bff/google/callback`

ใช้โดย frontend BFF เท่านั้นหลัง Google redirect กลับมาที่ `/auth/callback` ของ frontend แล้ว frontend จะ forward `code` และ `state` มาที่ route นี้

backend จะ:

- verify trusted BFF secret
- exchange authorization code ด้วย callback URL ของ frontend
- verify Google identity
- ออก `sci_session_token`
- refresh/rotate `sci_csrf_token`
- คืน `return_to` ให้ frontend ใช้ redirect browser ต่อ

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

### `GET /profile/me`

ใช้สำหรับ frontend/BFF ที่ต้อง bind ข้อมูลส่วนตัวลง UI โดยคัดเฉพาะ field ที่ปลอดภัยสำหรับแสดงผลจริง และไม่คืนค่า internal identifiers เช่น `session_id`, `google_sub`, token หรือ secret ภายในระบบ

response ตัวอย่าง:

```json
{
  "authenticated": true,
  "email": "6534440323@student.chula.ac.th",
  "hosted_domain": "student.chula.ac.th",
  "name": "Piya Saenchu",
  "picture": null,
  "auth_provider": "google_oidc",
  "display_name": "Piya Saenchu",
  "display_email": "6534440323@student.chula.ac.th",
  "avatar_url": null,
  "account_type": "student",
  "domain_verified": true,
  "allowed_domains": ["chula.ac.th", "student.chula.ac.th"],
  "auth_mode": "private",
  "role": "user",
  "student_id": "6534440323",
  "faculty": null,
  "department": null,
  "degree_level": null,
  "phone": null,
  "profile_completed": false
}
```

หมายเหตุ:

- `faculty`, `department`, `degree_level`, `phone` เป็น `null` จนกว่าจะมีแหล่งข้อมูล profile ที่ระบบเชื่อถือได้
- ถ้าต้องการแค่ตรวจว่า login แล้วหรือยัง ให้ใช้ `GET /oidc/me`
- ถ้าต้องการ bind profile ลงหน้าเว็บ ให้ใช้ `GET /profile/me`
- endpoint นี้ไม่คืนค่า token, `session_id`, หรือ `google_sub`

### `POST /profile/details`

ใช้สำหรับอ่านข้อมูลส่วนตัวในระดับที่เข้มขึ้น โดย route นี้อยู่หลัง `authMiddleware`, ต้องมี `x-csrf-token`, และใช้ secure JSON transport เช่นเดียวกับ `POST /session/init`

plaintext request body ก่อนเข้ารหัส:

```json
{
  "_ts": 1711886400000,
  "nonce": "profile-details-12345",
  "include_sensitive_personal_data": true
}
```

response ตัวอย่างหลังถอดรหัส:

```json
{
  "authenticated": true,
  "email": "6534440323@student.chula.ac.th",
  "hosted_domain": "student.chula.ac.th",
  "name": "Piya Saenchu",
  "picture": null,
  "auth_provider": "google_oidc",
  "display_name": "Piya Saenchu",
  "display_email": "6534440323@student.chula.ac.th",
  "avatar_url": null,
  "account_type": "student",
  "domain_verified": true,
  "allowed_domains": ["chula.ac.th", "student.chula.ac.th"],
  "auth_mode": "private",
  "role": "user",
  "student_id": "6534440323",
  "faculty": null,
  "department": null,
  "degree_level": null,
  "phone": null,
  "profile_completed": false,
  "personal_data": {
    "legal_name": "Piya Saenchu",
    "display_name": "Piya Saenchu",
    "email": "6534440323@student.chula.ac.th",
    "hosted_domain": "student.chula.ac.th",
    "picture": null,
    "student_id": "6534440323",
    "faculty": null,
    "department": null,
    "degree_level": null,
    "phone": null
  },
  "privacy": {
    "classification": "personal_data",
    "transport": "secure_json",
    "encrypted": true
  }
}
```

หมายเหตุ:

- route นี้เหมาะกับข้อมูลส่วนตัวที่ต้องการป้องกันระดับสูงกว่า summary profile
- backend จะยังไม่คืนค่า internal identifiers เช่น `session_id`, `google_sub`, token หรือ secret ภายใน

### `POST /oidc/logout`

ลบ `sci_session_token` และ revoke session record ฝั่ง server

เงื่อนไขเพิ่มเติม:

- request ต้องมาจาก browser origin ที่อยู่ใน frontend allowlist
- ต้องแนบ `x-csrf-token` ถ้าเรียกผ่าน session cookie จาก browser
- route นี้รองรับทั้ง cookie auth เดิมและ trusted BFF auth ผ่าน `authMiddleware`
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

- frontend หรือ BFF client ควรเรียก endpoint นี้หลัง `GET /oidc/me`
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

หมายเหตุ:

- ใน private BFF mode endpoint นี้ควรถูกเรียกผ่าน frontend BFF เท่านั้น ไม่ควรเปิดให้ browser เรียก backend ตรง

response ตัวอย่าง:

```json
{
  "message": "Session initialized",
  "session_id": "sess_abc123",
  "csrf_token": "random-token-value"
}
```

## Document Merge

### `POST /documents/merge`

ข้อจำกัดและพฤติกรรมเพิ่มเติม:

- signed URL สำหรับดาวน์โหลดไฟล์ที่ merge แล้วมีอายุสั้น โดย default คือ 15 นาที
- backend อาจตอบ `413` ถ้าขนาดรวมของไฟล์ต้นฉบับเกินเพดานที่กำหนดไว้สำหรับการ merge

## Upload Endpoint

### `POST /upload`

ข้อจำกัดและพฤติกรรมเพิ่มเติม:

- จำกัดอัปโหลดครั้งละ 1 ไฟล์
- ขนาดไฟล์อัปโหลดทั่วไปยังถูกคุมด้วย policy ของ backend
- PDF มีเพดานขนาดที่เข้มกว่ารูปภาพสำหรับการ sanitize อย่างปลอดภัย
- backend อาจตอบ `413` ถ้าไฟล์เกินเพดานที่ยอมรับได้หลัง verification/decryption

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
- production target ใหม่ไม่ควรใช้ browser direct-to-backend flow; browser ควรเข้า frontend BFF แล้วให้ BFF proxy ไป backend private
- ถ้าต้องการ OIDC หลาย provider ในอนาคต ควรแยก abstraction ออกจาก Google-specific logic ใน `utils/oidcUtils.js`
