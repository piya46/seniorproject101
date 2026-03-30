# Frontend Integration Guide

Version: `v1.9.7`
Last updated: `2026-03-31`

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
- frontend ต้องแนบ header `x-csrf-token` ในทุก `POST`, `PUT`, `PATCH`, `DELETE` ที่ใช้ session cookie
- แนะนำให้เก็บ token นี้ไว้ใน API client กลาง แล้ว refresh ผ่าน `GET /auth/csrf-token` หลัง login หรือเมื่อสร้าง session ใหม่
- ใน production BFF mode frontend server ควร forward cookie และ `x-csrf-token` ให้ backend แทน browser

## Secure JSON

secure JSON endpoints:

- `POST /session/init`
- `POST /validation/check-completeness`
- `POST /documents/merge`
- `POST /chat/recommend`

และ multipart endpoints ที่ต้องแนบ CSRF เช่นกัน:

- `POST /upload`
- `POST /support/technical-email`

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
