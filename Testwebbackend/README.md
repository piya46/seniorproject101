# Testwebbackend

Local-first static QA scaffold for validating the backend directly from a browser.

deployment shape ที่เอกสารนี้อิง:

- local QA page on `http://localhost:5173` หรือ static host อื่น
- backend on `https://sci-request-system-466086429766.asia-southeast3.run.app`
- authentication via Google OIDC

## Files

- `index.html` main QA dashboard

## Local Run

ใช้ static server อะไรก็ได้ เช่น:

```bash
cd /Users/pst./senior/Testwebbackend
python3 -m http.server 5173
```

แล้วเปิด:

```text
http://localhost:5173/index.html
```

ถ้าใช้ Vite หรือ server อื่นก็ได้ ขอแค่ origin ที่ใช้จริงถูกเพิ่มไว้ใน backend `FRONTEND_EXTRA_URLS`

ตัวอย่างถ้าใช้ Live Server หรือ static server ที่เสิร์ฟจาก root โปรเจกต์บน:

```text
http://127.0.0.1:5500/Testwebbackend/index.html
```

ถ้าจะรองรับทั้ง Vite และ Live Server พร้อมกัน ให้เพิ่มสอง origin นี้ตอน deploy backend:

```bash
FRONTEND_EXTRA_URLS="http://localhost:5173|http://127.0.0.1:5500"
```

## Recommended Flow

1. Open Google Login
2. Run `GET /oidc/me`
3. Run `POST /session/init`
4. Test forms/upload/validation/merge/chat/support

## Notes

- backend ที่ใช้จริงตอนนี้คือ `https://sci-request-system-466086429766.asia-southeast3.run.app`
- ถ้ารันจาก localhost ต้องเพิ่ม origin ที่ใช้จริงผ่าน `FRONTEND_EXTRA_URLS` ตอน deploy backend
- production ปกติควรเก็บ `FRONTEND_URL=https://pstpyst.com` และไม่ควรปล่อย localhost ค้างเป็น default behavior
- dashboard นี้เป็น QA scaffold ไม่ใช่ frontend หลักของระบบ
- ถ้าใช้เฉพาะ local testing ไม่จำเป็นต้องมี Docker หรือ Cloud Run สำหรับโฟลเดอร์นี้
