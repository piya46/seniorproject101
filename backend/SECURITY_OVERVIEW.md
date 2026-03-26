# Security Overview

Last updated: `2026-03-26`

เอกสารนี้สรุป security posture ของระบบหลัง migration ไปเป็น Google OIDC แบบ in-app และไม่ใช้ IAP/LB เป็น auth gate แล้ว

## Production Topology

production topology ใหม่:

- `pstpyst.com` = frontend
- `https://sci-request-system-466086429766.asia-southeast3.run.app` = backend Cloud Run
- auth = Google OIDC ที่ backend
- transport security = HTTPS/TLS
- session = `sci_session_token` แบบ `HttpOnly`
- canonical OAuth callback = `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback`

## Security Layers ที่ยังคงอยู่

### 1. Google OIDC Identity Verification

backend จะ:

- redirect ผู้ใช้ไป Google OIDC login
- verify signed `id_token`
- ตรวจ `issuer`
- ตรวจ `audience`
- ตรวจ `state`
- ตรวจ `nonce`
- ตรวจ `email_verified`

จุดที่เกี่ยวข้อง:

- [oidcAuthRoutes.js](/Users/pst./senior/backend/routes/oidcAuthRoutes.js)
- [oidcUtils.js](/Users/pst./senior/backend/utils/oidcUtils.js)

### 2. Domain Enforcement

ระบบยัง enforce domain allowlist เหมือนเดิมผ่าน:

- `OIDC_ALLOWED_DOMAINS`
- `OIDC_REQUIRE_HOSTED_DOMAIN`

โดยตรวจทั้ง:

- email domain
- Google Workspace hosted domain (`hd`)

ดังนั้นแม้ user จะเป็น Google account ธรรมดา ถ้าไม่อยู่ในโดเมนที่อนุญาตก็ยังเข้าไม่ได้

### 3. Server-Managed Session

หลัง login สำเร็จ backend จะออก `sci_session_token`

properties สำคัญ:

- `HttpOnly`
- `Secure` ใน production
- `SameSite=None` ใน production
- signed ด้วย `JWT_SECRET`

session cookie ไม่ถูก expose ให้ frontend อ่านเอง

### 4. Session Record And Revocation

middleware auth ยังตรวจ session record ใน Firestore

ดังนั้น:

- ถ้า session ถูก revoke
- หรือไม่มี session record

request จะถูกปฏิเสธ แม้ cookie จะยังมีอยู่

`POST /oidc/logout` ตอนนี้จะลบทั้ง cookie และ session record ฝั่ง Firestore

OIDC login callback จะ regenerate `session_id` ใหม่เสมอเมื่อสร้าง app session เพื่อหลีกเลี่ยงการ reuse session เดิมก่อน login

### 5. App-Level Encryption

secure JSON endpoints ยังใช้ encryption layer เดิม:

- RSA-OAEP สำหรับ encrypt AES key
- AES-256-GCM สำหรับ encrypt payload

layer นี้ยังคงเป็น defense-in-depth เพิ่มจาก TLS ปกติ

### 6. Validation And Origin Checks

ยังมี:

- request validation
- file signature validation
- size limits
- multipart allowlist เฉพาะ endpoint ที่ตั้งใจรับไฟล์จริง
- multipart browser requests ต้องผ่าน frontend origin allowlist ด้วย
- logout origin checks สำหรับ state-changing browser request
- state-changing requests ที่ใช้ session cookie ต้องผ่าน anti-CSRF token (`sci_csrf_token` + `x-csrf-token`) เพิ่มอีกชั้น
- support endpoint origin/referer checks
- business rule validation

### 7. Rate Limiting

rate limiting ยังอยู่ และ strict limiter ตอนนี้พยายามผูกกับ `session_id`/email ก่อน fallback เป็น IP เพื่อให้การป้องกัน route สำคัญไม่พึ่ง IP อย่างเดียว

store ของ rate limit ตอนนี้ใช้ Firestore แทน in-memory store แล้ว เพื่อให้พฤติกรรมสม่ำเสมอขึ้นเมื่อ scale หลาย Cloud Run instance

upload/support routes ก็รับไฟล์ลง temp file ใน `/tmp` ก่อน และพยายาม process จาก path ให้มากที่สุด เพื่อลด peak RAM จาก concurrent upload

AI usage รายวันถูกเก็บใน Firestore collection `AI_USAGE_DAILY` และตั้ง `expire_at` สำหรับ TTL แล้ว โดย retention กำหนดได้ผ่าน `AI_USAGE_RETENTION_DAYS`

ข้อมูลที่เก็บไม่ได้มีแค่ token รวม แต่รวม context สำหรับ analytics ด้วย เช่น `degree_levels`, `form_codes`, `success_count`, `failure_count`, และ `last_failure_reason`

การตรวจดู usage ตอนนี้ตั้งใจให้ดูตรงจาก Firestore/Cloud Console แทนการเปิด admin report endpoint ในแอป

### 8. Cloud Run IAM / Service Account Isolation

service account แยกของระบบและสิทธิ์ Secret Manager / Storage / Firestore ยังใช้เหมือนเดิม

### 9. Split Status Endpoints

ตอนนี้ status endpoints ถูกแยกเป็น 2 ระดับ:

- `GET /api/v1/system/status`
  ใช้เป็น public liveness endpoint แบบ minimal
- `GET /api/v1/system/status/storage-signing`
  ใช้เป็น public smoke probe เพื่อตรวจว่า runtime ยังสร้าง signed URL ได้อยู่
- `GET /api/v1/system/status/details`
  ต้องมี authenticated session ก่อน และใช้สำหรับ internal QA/ops เมื่อต้องดู runtime/config เชิงลึก

แนวทางนี้ช่วยให้ public endpoint ไม่เปิดเผยข้อมูลภายในเกินจำเป็น แต่ยังคงมี detailed status สำหรับ troubleshooting ได้

## สิ่งที่ลดลงจากสถาปัตยกรรมเดิม

เมื่อเทียบกับระบบเดิมที่มี `IAP + app session`:

- outer access gate ของ Google IAP หายไป
- request จะไม่ถูก block ที่ edge ก่อนถึงแอปอีก
- ความเข้มแบบ defense-in-depth เชิง infrastructure ลดลง 1 ชั้น

ดังนั้นคำสรุปที่ตรงที่สุดคือ:

- `ไม่ใช่ insecure`
- แต่ `ไม่เท่ากับ IAP + app-layer เดิม` ในเชิง layered security

## ทำไมยังถือว่าปลอดภัยได้

เพราะ auth หลักไม่ได้หายไป แต่ย้ายเข้ามาอยู่ในแอปอย่างชัดเจน:

- verified Google identity
- enforced university domain
- server-issued session
- session revocation
- validation
- encryption
- rate limiting

ถ้าดูในเชิงแอป auth/control, ระบบยังเข้มอยู่

## Risk Notes

### 1. OIDC Client Secret ต้องดูแลดี

ตอนนี้ `GOOGLE_OIDC_CLIENT_SECRET` เป็น secret สำคัญ

ต้อง:

- เก็บใน Secret Manager
- ไม่ hardcode ลง repo
- จำกัดสิทธิ์ผู้เข้าถึง

### 2. `run.app` เป็น production entrypoint อยู่ตอนนี้

เพราะไม่ได้ใช้ IAP/LB เป็น outer gate แล้ว และ region ปัจจุบันไม่รองรับ domain mapping ตามที่ต้องการ production path ตอนนี้จึงใช้ `run.app` โดยตรง

ข้อที่ต้องยอมรับ:

- จะมี public origin ของ backend เพิ่มขึ้น 1 จุด
- ไม่ถือว่า auth พัง ถ้า app-layer OIDC ยังบังคับครบ
- surface area จะกว้างกว่าการมี custom domain เพียงจุดเดียว

### 3. Allowed Domain Is Critical

ถ้าตั้ง `OIDC_ALLOWED_DOMAINS` กว้างเกินไป security จะอ่อนลงทันที

production ที่แนะนำ:

```text
OIDC_ALLOWED_DOMAINS=chula.ac.th,student.chula.ac.th
OIDC_REQUIRE_HOSTED_DOMAIN=true
```

### 4. Frontend Origin Allowlist ควรแคบที่สุด

origin allowlist ฝั่ง frontend มีผลกับ:

- `return_to`
- browser credentialed requests
- support/upload origin checks

production ที่แนะนำ:

```text
FRONTEND_URL=https://pstpyst.com
FRONTEND_EXTRA_URLS=
```

ถ้าต้องใช้ dev local:

- ให้เพิ่มผ่าน `FRONTEND_EXTRA_URLS` ชั่วคราว
- ไม่ควรปล่อย `localhost` ค้างใน production deploy โดยไม่จำเป็น

## Recommended Production Posture

ค่าที่แนะนำ:

- `NODE_ENV=production`
- `OIDC_ENABLED=true`
- `OIDC_ALLOWED_DOMAINS=chula.ac.th,student.chula.ac.th`
- `OIDC_REQUIRE_HOSTED_DOMAIN=true`
- `FRONTEND_URL=https://pstpyst.com`
- `FRONTEND_EXTRA_URLS=` (เว้นว่างใน production ปกติ)
- Google OIDC credentials เก็บใน Secret Manager

## Summary

หลัง migration:

- app-layer security หลักยังอยู่ครบ
- domain enforcement ยังอยู่
- session security ยังอยู่
- encryption/rate limit/validation ยังอยู่

แต่:

- infrastructure gate แบบ IAP ไม่อยู่แล้ว

ดังนั้น security posture ใหม่คือ:

`แข็งในระดับแอปและ identity verification`

แต่

`มี defense-in-depth น้อยกว่าระบบที่มี IAP หน้า backend`
