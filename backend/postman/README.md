# Postman Guide

Version: `v1.9.1`
Last updated: `2026-03-26`

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
- Production: `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1`
- Canonical OAuth callback: `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback`

## Production Auth Flow

1. เปิด `GET /oidc/google/login?return_to=https://pstpyst.com`
2. login ผ่าน Google
3. backend callback ตั้ง session cookie
4. เรียก `GET /oidc/me`
5. ค่อยเรียก `POST /session/init` และ endpoint อื่น

## Collection Notes

- collection-level scripts ยังช่วยเรื่อง secure JSON transport ให้เหมือนเดิม
- business body ยังต้องถูกเข้ารหัสสำหรับ secure JSON endpoints
- `GET` endpoints และ multipart upload ไม่ใช้ secure JSON wrapper

## Useful Commands

```bash
npm run docs:postman:validate
npm run docs:api:printable
```
