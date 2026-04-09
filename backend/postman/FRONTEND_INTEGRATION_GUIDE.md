# Frontend Integration Guide

Version: `v1.10.2`
Last updated: `2026-04-08`

คู่มือนี้อธิบายสิ่งที่ frontend ต้องทำเพื่อเชื่อมต่อ backend ในโหมด Google OIDC + session cookie + secure JSON transport โดย direct backend browser flow ให้ถือเป็น legacy/direct mode และ production target ใหม่คือ frontend BFF + private backend

หมายเหตุ:

- ถ้า backend ใช้ `run.app` โดยตรงและ frontend อยู่คนละ origin เช่น `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app` ระบบจะยังเป็น `cross-origin`
- ดังนั้น flow นี้ไม่ได้แก้ CORS/preflight ด้วยตัวมันเอง
- ถ้า deploy แบบ private backend ให้ใช้ [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md) เป็นหลักสำหรับ server-to-server forwarding

## Main Flow (Production BFF Mode)

1. browser เปิด `/auth/login` ที่ frontend
2. frontend BFF ขอ Google login URL จาก backend `GET /oidc/bff/google/login-url`
3. Google redirect กลับ `/auth/callback` ที่ frontend
4. frontend BFF เรียก backend `GET /oidc/bff/google/callback`
5. frontend/BFF เรียก `GET /oidc/me`
6. frontend/BFF เรียก `GET /profile/me` ถ้าต้อง bind ข้อมูลส่วนตัวลงหน้าเว็บ
7. frontend/BFF เรียก `GET /auth/csrf-token`
8. จากนั้นค่อยเรียก `POST /session/init`
9. endpoint ที่เปลี่ยน state ทุกตัวต้องส่ง header `x-csrf-token` ให้ตรงกับ token ปัจจุบัน
10. ถ้าต้องอ่านข้อมูลส่วนตัวระดับเข้มขึ้น ให้ใช้ `POST /profile/details` ผ่าน secure JSON transport
11. ถ้าเปิด `PFS_V2_ENABLED=true` ให้ frontend/BFF เริ่มด้วย `GET /api/v2/auth/handshake` แล้วค่อยส่ง protected JSON endpoints ด้วย envelope แบบ `v2`
12. ถ้าต้องแสดงสถานะโควต้า AI ใน chat widget ให้เรียก `GET /chat/usage` หลัง session พร้อม แล้ว cache ฝั่ง UI ได้เฉพาะเพื่อ UX ไม่ใช่ source of truth

## Legacy/Direct Mode

1. เรียก `GET /oidc/google/login?return_to=<frontend-url>`
2. หลัง redirect กลับมา เรียก `GET /oidc/me` ด้วย `credentials: 'include'`
3. เมื่อ session พร้อมแล้ว ให้เรียก `GET /auth/csrf-token`
4. จากนั้นค่อยเรียก `POST /session/init`
5. endpoint ที่เปลี่ยน state ทุกตัวต้องส่ง header `x-csrf-token` ให้ตรงกับ token ปัจจุบัน
6. จากนั้นเรียก endpoint ที่ต้อง auth อื่น

## Production Flow

1. browser เรียก frontend BFF
2. frontend BFF เป็น owner ของ browser-facing auth/session flow
3. frontend BFF เรียก backend แบบ private server-to-server
4. frontend BFF ส่ง trusted headers ตาม [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)

## Cookie

frontend ต้องใช้ต่อทั้งใน BFF mode และ legacy/direct mode เพราะ backend auth หลักยังเป็น cookie-backed session:

- `credentials: 'include'` กับ `fetch`
- `withCredentials: true` กับ `axios`

cookie/security headers ที่เกี่ยวข้อง:

- backend จะ set cookie `sci_csrf_token`
- production BFF mode ควรใช้ `COOKIE_SAME_SITE=Lax` และ `COOKIE_SECURE=true`
- frontend ต้องแนบ header `x-csrf-token` ในทุก `POST`, `PUT`, `PATCH`, `DELETE` ที่ใช้ session cookie
- แนะนำให้เก็บ token นี้ไว้ใน API client กลาง แล้ว refresh ผ่าน `GET /auth/csrf-token` หลัง login หรือเมื่อสร้าง session ใหม่
- ใน production BFF mode frontend server ควร forward cookie และ `x-csrf-token` ให้ backend แทน browser
- `POST /oidc/logout` จะส่ง `Clear-Site-Data: "cache", "cookies", "storage"` เพื่อให้ browser-side state ถูกล้างแรงขึ้นใน browser ที่รองรับ
- response ที่อยู่หลัง authenticated middleware ถูกตั้ง `Cache-Control: private, no-store, max-age=0, must-revalidate` จึงไม่ควรพึ่ง browser cache สำหรับข้อมูล auth/profile/usage

## Secure JSON

secure JSON endpoints:

- `POST /session/init`
- `POST /validation/check-completeness`
- `POST /documents/merge`
- `POST /chat/recommend`

หมายเหตุสำหรับ `POST /validation/check-completeness`:

- frontend สามารถส่ง `submission_context` เพื่อช่วยให้ backend/AI ตรวจเงื่อนไขเวลาได้แม่นขึ้น
- ถ้า frontend ไม่ส่ง `submission_context.submission_date` backend จะเติมวันที่ปัจจุบันตามเวลา Bangkok ให้อัตโนมัติ
- frontend สามารถส่ง `academic_calendar_context` ได้ถ้ามีข้อมูลปฏิทินปีการศึกษาจริงอยู่แล้ว
- ถ้ายังไม่มี `academic_calendar_context` แต่มี `submission_context.academic_year` backend จะพยายาม lookup จาก dataset ภายใน
- response `200` เป็น structured validation result และมี `legacy_document_results` เพื่อให้ UI เดิมยังอ่านผลรายเอกสารได้

ถ้าเปิด `PFS_V2_ENABLED=true`:

- secure JSON endpoints ด้านบนสามารถใช้ envelope แบบ `v2` ได้
- backend จะ derive `request_key` และ `response_key` แยกกัน
- rollout ควรทำแบบ opt-in ฝั่ง frontend/BFF ก่อน ไม่ควร flip พร้อมกันทั้งหมดทันที

หมายเหตุสำหรับ `POST /documents/merge`:

- route นี้จะตอบ `202 queued` พร้อม `job.id`
- frontend ต้อง poll `GET /documents/jobs/:jobId`
- เมื่อ job สำเร็จค่อยเรียก `GET /documents/jobs/:jobId/download`
- route `/download` จะคืน `download_path` สำหรับ backend route `GET /documents/jobs/:jobId/file`
- frontend ควรเปิด `download_path` นี้ตรง ๆ แทนการใช้ signed URL จาก storage
- backend อาจตอบ `413` ถ้าขนาดรวมของไฟล์ต้นฉบับเกินเพดานที่ระบบยอมรับ

และ multipart endpoints ที่ต้องแนบ CSRF เช่นกัน:

- `POST /upload`
- `POST /support/technical-email`

หมายเหตุสำหรับ `POST /upload`:

- route นี้จะตอบ `200 success` เพื่อ stage ไฟล์ไว้ก่อน
- ถ้าไฟล์ยังไม่พร้อมตอนเรียก `POST /validation/check-completeness` backend จะตอบ `202 queued` พร้อม batch `job.id`
- frontend ต้อง poll `GET /upload/jobs/:jobId` จน `status=succeeded` หรือ `status=partial_failed`
- PDF มีเพดานขนาดที่เข้มกว่ารูปภาพเพื่อจำกัดความเสี่ยงด้าน memory/resource exhaustion
- backend อาจตอบ `413` ถ้าไฟล์เกิน policy หลัง verification หรือหลัง decrypt แล้ว

หมายเหตุสำหรับ production BFF hardening:

- ถ้าต้องการ tighten service identity เพิ่ม ให้เปิด `TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN=true`
- frontend/BFF ต้องส่ง `x-bff-identity-token` ที่เป็น Google-signed identity token มาด้วย
- ดู header contract เพิ่มเติมที่ [BFF_BACKEND_CONTRACT.md](/Users/pst./senior/backend/BFF_BACKEND_CONTRACT.md)
- ถ้าต้องการใช้ chat quota indicator ให้เรียก `GET /chat/usage` แยกจาก `POST /chat/recommend` แทนการ parse จาก reply endpoint อย่างเดียว

frontend ควรมี API client กลางที่รับผิดชอบ:

- ดึง public key
- ดึงและ cache CSRF token
- สร้าง AES key และ IV ใหม่ต่อ request
- เข้ารหัส business JSON
- ถอดรหัส encrypted response
- แนบ `x-csrf-token` อัตโนมัติให้ทุก request ที่เปลี่ยน state

## Allowed Origins

`return_to` และ browser origins ต้องอยู่ใน frontend allowlist ของ backend

ค่าแนะนำ:

- `FRONTEND_URL` = production origin หลัก
- `FRONTEND_EXTRA_URLS` = temporary dev/QA override

production ที่แนะนำ:

```text
FRONTEND_URL=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app
```

ถ้ารัน frontend/QA จาก localhost ให้เพิ่ม origin นั้นผ่าน `FRONTEND_EXTRA_URLS` ตอน deploy เช่น:

```text
FRONTEND_URL=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app
FRONTEND_EXTRA_URLS=http://localhost:5173|http://127.0.0.1:5500
```

ข้อสำคัญ:

- อย่าทำให้ `localhost` กลายเป็น default production behavior
- ให้มอง `FRONTEND_EXTRA_URLS` เป็น temporary dev/QA override เท่านั้น
- ถ้าใช้ Google OAuth client สำหรับ browser flow ให้เพิ่ม `Authorised JavaScript origins` ตาม origin ที่ใช้งานจริง เช่น `https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app`, `http://localhost:5173`, และ `http://127.0.0.1:5500`
- ถ้าต้องการคำสั่ง deploy แบบ copy/paste สำหรับ production หรือ QA ให้ดู [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)
