# BFF Backend Contract

เอกสารนี้กำหนดสัญญาการเรียกใช้งานระหว่าง `ai-formcheck-frontend` ในบทบาท Backend-for-Frontend (BFF) กับ `ai-formcheck-backend` เมื่อ backend ถูก deploy เป็น Cloud Run แบบ private และต้องไม่ลด security controls เดิมของระบบ

## Goal

- ให้ browser/mobile client คุยกับ frontend/BFF เท่านั้น
- ให้ frontend/BFF เรียก backend แบบ server-to-server
- ให้ backend คง controls เดิมไว้:
  - Cloud Run IAM
  - session revocation
  - OIDC domain restrictions
  - CSRF/origin policy
  - encrypted payload policy สำหรับ secure JSON routes

## Security Model

implementation ที่แนะนำตอนนี้คือ backend ใช้การยืนยันตัวตนหลายชั้นดังนี้:

1. Cloud Run service-to-service authentication
2. Trusted BFF shared secret
3. Optional Google-signed service identity token attestation (`TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN=true`)
4. Cookie-backed backend session (`sci_session_token`) ที่ frontend/BFF forward มา
5. CSRF + origin policy สำหรับ state-changing/browser-derived requests

trusted forwarded user identity headers ยังรองรับได้ แต่ถือเป็น fallback/advanced mode ไม่ใช่ flow หลักที่ frontend ปัจจุบันใช้อยู่

## Required Deploy Config

backend ควร deploy ด้วยค่าอย่างน้อย:

```bash
CLOUD_RUN_AUTH_MODE="private"
TRUST_PROXY="1"
COOKIE_SAME_SITE="Lax"
COOKIE_SECURE="true"
TRUSTED_BFF_AUTH_ENABLED="true"
TRUSTED_BFF_AUTH_HEADER_NAME="x-bff-auth"
TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN="true"
TRUSTED_BFF_IDENTITY_TOKEN_HEADER="x-bff-identity-token"
TRUST_PROXY_BROWSER_ORIGIN_HEADER="true"
BROWSER_ORIGIN_HEADER_NAME="x-browser-origin"
FRONTEND_SERVICE_ACCOUNT_NAME="ai-formcheck-frontend-sa"
```

frontend/BFF ต้องมี `roles/run.invoker` บน backend service

## Request Path

production flow ที่รองรับในโค้ดตอนนี้:

1. Browser เรียก frontend/BFF
2. frontend/BFF เริ่ม login ที่ `/auth/login`
3. frontend/BFF เรียก backend `GET /api/v1/oidc/bff/google/login-url`
4. Google redirect กลับ `/auth/callback` บน frontend
5. frontend/BFF เรียก backend `GET /api/v1/oidc/bff/google/callback`
6. backend ออก `sci_session_token` และ `sci_csrf_token`
7. frontend/BFF proxy request อื่นไป backend โดย forward cookie และ CSRF token

fallback flow สำหรับ advanced integrations:

1. frontend/BFF สร้าง/ถือ user session ของตัวเอง
2. frontend/BFF เรียก backend โดยใช้ Cloud Run authenticated invocation
3. frontend/BFF ส่ง trusted identity headers ตาม contract นี้

## Required Headers

headers ที่ frontend/BFF ปัจจุบันควรส่งในทุก request ไป backend:

```http
Authorization: Bearer <cloud-run-id-token>
x-bff-auth: <trusted-bff-shared-secret>
x-bff-identity-token: <google-signed-id-token-for-frontend-service-account>
x-browser-origin: <original-browser-origin>
Cookie: sci_session_token=<...>; sci_csrf_token=<...>
```

headers ด้านล่างเป็นของ fallback/advanced mode เมื่อไม่ใช้ cookie-backed backend session:

```http
x-bff-auth: <trusted-bff-shared-secret>
x-bff-user-session-id: <sess_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx>
x-bff-user-email: <user-email>
x-bff-user-hosted-domain: <hosted-domain-or-empty>
x-bff-user-google-sub: <google-sub-or-empty>
x-bff-user-name: <display-name-or-empty>
x-bff-user-picture: <picture-url-or-empty>
x-browser-origin: <original-browser-origin>
```

## Header Semantics

### `x-bff-auth`

- เป็น shared secret ระหว่าง frontend/BFF กับ backend
- backend อ่านชื่อ header จาก `TRUSTED_BFF_AUTH_HEADER_NAME`
- ค่าจริงถูกเก็บใน Secret Manager ผ่าน `TRUSTED_BFF_SHARED_SECRET`
- ต้องส่งจาก server เท่านั้น
- ห้าม expose ไปยัง browser, mobile app, หรือ third-party client

### `x-bff-identity-token`

- ใช้เมื่อเปิด `TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN=true`
- ควรเป็น Google-signed identity token ของ frontend/BFF service account
- audience ควรตรงกับ backend service URL ตาม `TRUSTED_BFF_IDENTITY_TOKEN_AUDIENCE`
- backend จะตรวจ email/service account ของ token ให้ตรงกับ `TRUSTED_BFF_EXPECTED_SERVICE_ACCOUNT_EMAIL`

### `x-bff-user-session-id`

- ใช้ session id ของผู้ใช้ในระบบ backend
- รูปแบบที่รองรับตอนนี้: `sess_<32 hex chars>`
- backend จะตรวจ session record ใน Firestore ต่ออีกชั้น
- ถ้า session ถูก revoke request ต้องถูกปฏิเสธ

### `x-bff-user-email`

- identity หลักของผู้ใช้
- backend ใช้ค่านี้เพื่อตรวจ domain allowlist

### `x-bff-user-hosted-domain`

- ใช้ร่วมกับ `OIDC_REQUIRE_HOSTED_DOMAIN=true`
- ควรตรงกับ Google Workspace hosted domain ของผู้ใช้

### `x-bff-user-google-sub`

- optional
- ใช้เก็บ identity reference ให้ครบขึ้นสำหรับ audit/debug

### `x-bff-user-name`

- optional
- ใช้เพื่อส่งต่อข้อมูล user profile ให้ route ที่ต้องการอ่าน

### `x-bff-user-picture`

- optional
- ใช้เพื่อส่งต่อรูป profile ถ้าต้องการ

### `x-browser-origin`

- ส่ง browser origin จริงของ request เดิม
- backend ใช้ค่านี้ต่อกับ origin allowlist เดิม
- ใช้กับ routes ที่เดิมพึ่ง `Origin`/`Referer` เช่น:
  - `/api/v1/upload`
  - `/api/v1/support/technical-email`
  - `/api/v1/oidc/logout`

## Backend Behavior

ถ้า request มี `sci_session_token`:

- backend ใช้ cookie flow เดิมก่อน
- auth middleware จะ verify JWT + session record + OIDC/domain policy
- security middleware จะ enforce CSRF กับ state-changing requests เหมือนเดิม

ถ้า `TRUSTED_BFF_AUTH_ENABLED=true` และไม่มี session cookie:

- backend จะพยายาม authenticate ผ่าน trusted BFF headers
- ถ้า shared secret ไม่ตรง ต้องตอบ `401`
- ถ้าเปิด identity token mode แล้ว token หาย/invalid/audience ไม่ตรง/issuer ไม่ถูกต้อง ต้องตอบ `401`
- ถ้า session id ไม่ถูกต้อง ต้องตอบ `401`
- ถ้า session record ไม่มีอยู่จริงหรือถูก revoke แล้ว ต้องตอบ `401`
- ถ้า email domain หรือ hosted domain ไม่ผ่าน policy ต้องตอบ `403`

ดังนั้น trusted BFF auth เป็น fallback ไม่ใช่การแทนที่ cookie auth โดยอัตโนมัติ

## Route Compatibility

routes เดิมยังคงเดิม ไม่ต้องเปลี่ยน path เพื่อรองรับ BFF:

- `GET /api/v1/auth/csrf-token`
- `POST /api/v1/session/init`
- `POST /api/v1/upload`
- `POST /api/v1/validation/check-completeness`
- `POST /api/v1/documents/merge`
- `POST /api/v1/chat/recommend`
- `POST /api/v1/support/technical-email`
- `GET /api/v1/oidc/me`

หมายเหตุ:

- state-changing secure JSON routes ยังต้องใช้ encrypted payload policy เดิม
- upload/support ยังต้องผ่าน origin allowlist
- `GET /api/v1/system/status/storage-signing` ตอนนี้ต้อง auth แล้ว

## Frontend/BFF Responsibilities

frontend/BFF ต้องรับผิดชอบเรื่องเหล่านี้:

1. เริ่ม browser-facing login ที่ `/auth/login`
2. จัดการ Google callback ที่ `/auth/callback`
3. forward backend session cookies และ CSRF token ให้ครบ
4. ส่ง Cloud Run authenticated request ไป backend
5. inject `x-bff-auth` และ `x-browser-origin`
6. ไม่เปิด shared secret ให้ client เห็น
7. ไม่ให้ client เรียก backend ตรง

## OIDC Migration Guidance

ถ้าจะใช้ private backend แบบสมบูรณ์:

1. frontend/BFF เป็นเจ้าของ browser-facing OIDC login/callback
2. browser redirect กลับมาที่ frontend domain (`/auth/callback`)
3. backend เป็นคน verify Google identity และออก backend session cookie ผ่าน BFF bridge route
4. frontend/BFF ใช้ backend session cookie นี้ต่อในการ proxy request อื่น

ถ้ายังใช้ backend เป็นเจ้าของ OIDC callback อยู่:

- backend จะยังต้อง public อย่างน้อยบาง path
- architecture จะยังไม่ private เต็มรูปแบบ

## Mobile And Other Clients

trusted BFF headers ไม่เหมาะกับ mobile app หรือ third-party client โดยตรง เพราะ shared secret จะถูกดึงออกจาก client ได้

ทางที่แนะนำ:

1. ให้ mobile เรียก frontend/BFF เหมือน browser
2. ให้ frontend/BFF เป็นตัวกลางเรียก backend ต่อ

ถ้าจำเป็นต้องให้ mobile เรียก backend โดยตรง:

- ควรออกแบบ auth mode ใหม่แยกต่างหาก
- ห้าม reuse `x-bff-auth` จากเอกสารนี้

## Failure Modes

backend ควรตอบประมาณนี้:

- `401 Unauthorized`
  - ไม่มี cookie และไม่มี trusted BFF auth ที่ถูกต้อง
  - session ถูก revoke
  - session id format ไม่ถูกต้อง
- `403 Forbidden`
  - domain policy ไม่ผ่าน
  - origin policy ไม่ผ่าน
- `415 Unsupported Media Type`
  - multipart มาผิด route

## Example BFF Request

```http
POST /api/v1/upload HTTP/1.1
Host: ai-formcheck-backend-<project-number>.asia-southeast3.run.app
Authorization: Bearer <cloud-run-id-token>
x-bff-auth: <trusted-bff-shared-secret>
x-bff-identity-token: <google-signed-id-token-for-frontend-service-account>
x-browser-origin: https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app
Cookie: sci_session_token=<httpOnly-cookie-forwarded-by-bff>; sci_csrf_token=<csrf-cookie>
x-csrf-token: <csrf-cookie-value>
Content-Type: multipart/form-data; boundary=...
```

## Non-Goals

เอกสารนี้ไม่ได้ครอบคลุม:

- mobile direct-to-backend auth
- third-party API access
- public API mode
- frontend internal session schema

สำหรับ use case เหล่านี้ควรออกแบบ auth contract แยกต่างหาก
