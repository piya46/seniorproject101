# Security Overview

Last updated: `2026-03-18`

เอกสารนี้สรุป security posture ปัจจุบันของ `sci-request-system`, สิ่งที่ดีขึ้นจากเดิม, และ checklist ที่ควรใช้เวลา audit หรือ deploy production

## Executive Summary

ภาพรวมตอนนี้ security **เพิ่มขึ้นจากเดิม** ไม่ได้ลดลง โดยเฉพาะในมุม production deployment และ login flow:

- backend production อยู่หลัง `HTTPS Load Balancer -> IAP -> Serverless NEG -> Cloud Run`
- Cloud Run ใช้ `internal-and-cloud-load-balancing`
- production deploy ใช้ `--no-allow-unauthenticated`
- production deploy ใช้ `--no-default-url`
- backend verify IAP JWT เพิ่มจากการมี session/JWT ภายในระบบเดิม
- secure JSON encryption layer เดิมยังอยู่ครบ
- session ยังถูกสร้างฝั่ง server เป็น `HttpOnly` cookie
- IAP completion flow ใหม่หลีกเลี่ยงการส่ง identity ผ่าน query string

## สิ่งที่ดีขึ้นจากเดิม

### 1. Production access path แคบลง

ก่อน hardening รอบนี้ production มีความเสี่ยงที่ allowlist จะกว้างเกินจำเป็น และมีโอกาสพึ่ง `run.app` หรือ localhost origins มากเกินไป

ตอนนี้:

- `deploy.sh` ใช้ `FRONTEND_URL=https://pstpyst.com` เป็น default
- dev/local origins ต้องเติมผ่าน `FRONTEND_EXTRA_URLS` เท่านั้น
- ลดโอกาสเผลอ deploy production ด้วย localhost allowlist

### 2. Cookie behavior production ชัดเจนขึ้น

`deploy.sh` now sets:

- `NODE_ENV=production`

ผลคือ session cookie ของระบบจะใช้ production options จาก [sessionUtils.js](/Users/pst./senior/backend/utils/sessionUtils.js):

- `httpOnly: true`
- `secure: true`
- `sameSite: 'None'`

### 3. IAP setup ครบกว่าเดิม

deployment automation ตอนนี้พยายามทำสิ่งต่อไปนี้ให้อัตโนมัติ:

- create IAP service identity
- grant `roles/run.invoker` ให้ IAP service agent บน Cloud Run
- ตั้ง backend audience สำหรับ IAP verification

ช่วยลด manual gap ที่เคยทำให้เกิด error เช่น:

- missing IAP service account
- backend audience misconfiguration

### 4. Login flow ปลอดภัยขึ้น

flow เดิมที่พยายามให้ IAP ของ `api.pstpyst.com` redirect ตรงไป `pstpyst.com` มีปัญหาเรื่อง topology และเสี่ยงต่อการออกแบบ auth state ที่ไม่เป็น server-driven

flow ใหม่:

1. user ผ่าน IAP ที่ `api.pstpyst.com`
2. backend route `GET /api/v1/iap/complete` สร้าง/reuse app session
3. backend redirect กลับ frontend พร้อมแค่ `auth=ok`
4. frontend เรียก `GET /api/v1/iap/me` ด้วย cookie เดิม

ข้อดี:

- ไม่ส่ง email/token ผ่าน query string
- backend เป็นผู้ควบคุม session state
- ลดการผูก auth flow ข้าม host แบบไม่จำเป็น

## Security Layers ปัจจุบัน

ระบบปัจจุบันมีหลายชั้น:

1. HTTPS ที่ load balancer
2. IAP เป็น outer access gate
3. backend verify IAP JWT
4. application session cookie (`sci_session_token`)
5. secure JSON encryption สำหรับ endpoint ที่กำหนด
6. route-specific validation เช่น origin check, file signature check, upload constraints

## จุดที่ยังควรระวัง

### 1. Custom OAuth secret ต้องเก็บให้ดี

ถ้า IAP ใช้ `Custom OAuth`:

- อย่า commit `client secret` ลง repo
- อย่าใส่ secret แบบ plain text ใน doc ภายใน repo
- ถ้าจะ automate เพิ่ม ให้เก็บ secret ใน Secret Manager แล้ว inject ตอน deploy

นี่ไม่ใช่จุดที่ทำให้ระบบอ่อนลงทันที แต่เป็น operational risk ที่ต้องคุมให้ดี

### 2. Local origins ควรใช้ชั่วคราวเท่านั้น

ถ้าจะทดสอบ `localhost` หรือ `127.0.0.1`:

- เติมผ่าน `FRONTEND_EXTRA_URLS`
- ใช้เท่าที่จำเป็น
- เอาออกเมื่อจบทดสอบ production

### 3. อย่าส่ง identity ผ่าน query string

หลัง IAP login สำเร็จ:

- ไม่ควรส่ง email ผ่าน `?email=...`
- ไม่ควรส่ง token ผ่าน URL
- ควรให้ frontend เรียก `GET /api/v1/iap/me` แทน

## Production Audit Checklist

ก่อนถือว่าระบบ production พร้อม ควรเช็กอย่างน้อย:

- cert ของ `api.pstpyst.com` เป็น `ACTIVE`
- Cloud Run ingress เป็น `internal-and-cloud-load-balancing`
- Cloud Run ไม่มี default URL (`--no-default-url`)
- IAP backend service เปิดใช้งานแล้ว
- Cloud Run มี `roles/run.invoker` สำหรับ `service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com`
- `IAP_EXPECTED_AUDIENCE` และ `IAP_BACKEND_SERVICE_ID` ถูกตั้งแล้ว
- `NODE_ENV=production`
- `FRONTEND_URL` เป็น production origin ที่ถูกต้อง
- ถ้าเปิด local testing อยู่ ให้ทบทวนว่าจำเป็นจริงหรือไม่

## Operational Recommendations

- ถ้าต้องการ QA จาก localhost ให้ใช้ `FRONTEND_EXTRA_URLS` แบบชั่วคราว ไม่แก้ production default
- ถ้าต้องการให้ deploy จบในรอบเดียว ให้ใช้ [deploy.sh](/Users/pst./senior/backend/deploy.sh) เวอร์ชันล่าสุด
- ถ้าต้องการ automation ของ `Custom OAuth`, ให้ใช้ Secret Manager แทน hardcode
- ถ้าต้องการ authorization เข้มกว่า domain-wide access ของ IAP, ให้พิจารณาใช้ Google Group แทนการเปิดทั้ง domain

## Related Docs

- [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)
- [IAP_DEPLOYMENT_GUIDE.md](/Users/pst./senior/backend/IAP_DEPLOYMENT_GUIDE.md)
- [API_DOCUMENTATION.md](/Users/pst./senior/backend/API_DOCUMENTATION.md)
- [FRONTEND_INTEGRATION_GUIDE.md](/Users/pst./senior/backend/postman/FRONTEND_INTEGRATION_GUIDE.md)
