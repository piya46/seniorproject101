# API Examples

Version: `v1.10.2`
Last updated: `2026-04-08`

ตัวอย่างด้านล่างอธิบาย flow หลักของระบบในโหมด OIDC-only โดย production target ใหม่คือ frontend BFF + private backend ส่วน direct backend browser flow ให้ถือเป็น legacy/direct mode

1. browser เปิด `GET /auth/login` ที่ frontend BFF
2. frontend BFF เรียก backend `GET /oidc/bff/google/login-url`
3. Google redirect กลับ `GET /auth/callback` ของ frontend
4. frontend BFF เรียก backend `GET /oidc/bff/google/callback`
5. ตรวจ session ด้วย `GET /oidc/me`
6. ถ้าต้อง bind ข้อมูลส่วนตัวลง UI ให้เรียก `GET /profile/me`
7. ดึง CSRF token ด้วย `GET /auth/csrf-token`
8. ดึง public key
9. เริ่ม session ด้วย `POST /session/init`
10. ถ้าต้องอ่านข้อมูลส่วนตัวระดับเข้ม ให้เรียก `POST /profile/details` แบบ secure JSON

หมายเหตุด้าน policy ล่าสุด:

- production ไม่ควรเปิด `ALLOW_BEARER_SESSION_TOKEN`
- ถ้าเปิด `PFS_V2_ENABLED=true` protected JSON endpoints สามารถรับ envelope แบบ `v2` ได้
- `POST /documents/merge` อาจตอบ `413` ถ้าขนาดรวมของ source files เกินเพดาน
- `POST /upload` อาจตอบ `413` โดยเฉพาะกรณี PDF ที่เกินเพดาน sanitize ของ backend
- `POST /upload` ตอนนี้ตอบ `200 success` เพื่อ stage ไฟล์ไว้ก่อน
- `POST /validation/check-completeness` อาจตอบ `202 queued` ถ้า backend ต้องเตรียมเอกสารก่อนตรวจ
- `POST /documents/merge` ตอบ `202 queued` แล้ว client ต้อง poll job status ต่อ

## Base URL

Production:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1
```

Public liveness endpoint:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/system/status
```

ตัวอย่าง response:

```json
{
  "status": "ok",
  "service": "ai-formcheck-backend",
  "message": "Service is available",
  "checks": {
    "configuration": {
      "status": "ok"
    },
    "oidc": {
      "status": "ok"
    },
    "crypto": {
      "status": "ok"
    }
  },
  "now": "2026-03-26T12:11:50.086Z"
}
```

Authenticated details endpoint:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/system/status/details
```

หมายเหตุ:

- endpoint นี้ต้องมี authenticated session ก่อน
- ใช้สำหรับ internal QA/ops เมื่อต้องดู runtime/config ลึกขึ้น

Authenticated storage-signing smoke probe:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/system/status/storage-signing
```

หมายเหตุ:

- endpoint นี้ต้อง auth แล้ว
- ใช้สำหรับ internal QA/ops หรือ BFF/internal caller ที่ผ่าน auth มาแล้ว

Legacy backend Google OAuth callback:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback
```

Frontend BFF Google OAuth callback:

```text
https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/callback
```

## 1. Open Google OIDC Login (BFF Production Flow)

### Browser URL

```text
https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/login?return_to=https%3A%2F%2Fai-formcheck-frontend-<project-number>.asia-southeast3.run.app
```

### JavaScript

```js
window.location.href =
  "https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app/auth/login?return_to=" +
  encodeURIComponent("https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app");
```

หมายเหตุ:

- browser ไม่ควรเรียก `GET /api/v1/oidc/bff/google/login-url` ตรง เพราะ route นี้รับเฉพาะ trusted BFF caller
- browser ไม่ควรเรียก `GET /oidc/google/login` ตรงใน production private mode

## 2. Open Google OIDC Login (Legacy/Direct Mode)

ตัวอย่าง URL:

```text
GET https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app
```

### Browser URL

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app
```

### JavaScript

```js
window.location.href =
  "https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=" +
  encodeURIComponent("https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app");
```

### PHP

```php
<?php
$returnTo = 'https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app';
$url = 'https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=' . rawurlencode($returnTo);
header('Location: ' . $url, true, 302);
exit;
```

### Python

```python
from urllib.parse import quote

return_to = "https://ai-formcheck-frontend-<project-number>.asia-southeast3.run.app"
url = "https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=" + quote(return_to, safe="")
print(url)
```

## 3. Read OIDC Session Status

หลัง browser ถูก redirect กลับจาก OIDC callback ให้เรียก `GET /oidc/me` พร้อม cookie เดิม

### cURL

```bash
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/me
```

หมายเหตุ:

- ถ้ายิงจาก terminal ที่ไม่ได้ผ่าน browser login มาก่อน อาจได้ `401`
- endpoint นี้มีประโยชน์ที่สุดเมื่อเรียกจาก browser ที่เพิ่งผ่าน login flow

### JavaScript

```js
const response = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/me", {
  method: "GET",
  credentials: "include"
});

const data = await response.json();
console.log(data);
```

### PHP

```php
<?php
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'ignore_errors' => true,
        'header' => "Accept: application/json\r\n",
    ],
]);

$body = file_get_contents('https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/me', false, $context);
echo $body;
```

### Python

```python
import requests

response = requests.get(
    "https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/me",
    allow_redirects=False,
)
print(response.status_code)
print(response.text)
```

## 4. Fetch Public Key

### cURL

```bash
curl -s https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/auth/public-key
```

## 5. PFS V2 Handshake

### cURL

```bash
curl -s https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v2/auth/handshake
```

หมายเหตุ:

- route นี้จะคืน `404` ถ้า `PFS_V2_ENABLED=false`
- frontend/BFF ต้องใช้ metadata นี้เพื่อ derive `request_key` และ `response_key` แยกกัน

## 6. Document Preparation Status

หลัง `POST /validation/check-completeness` ถ้าไฟล์ยังไม่พร้อม backend จะตอบ `202` พร้อม `job.id`

### cURL

```bash
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/upload/jobs/<job-id>
```

สถานะหลัก:

- `queued`
- `processing`
- `succeeded`
- `partial_failed`
- `failed`

## 7. Async Merge Status And Download

หลัง `POST /documents/merge` backend จะตอบ `202` พร้อม `job.id`

### cURL

```bash
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/documents/jobs/<job-id>
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/documents/jobs/<job-id>/download
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/documents/jobs/<job-id>/file
```

หมายเหตุ:

- endpoint job status ของทั้ง upload/prepare และ merge อาจคืน `queued`, `processing`, `succeeded`, `partial_failed`, หรือ `failed`
- endpoint `/download` จะใช้ได้เมื่อ job อยู่ในสถานะ `succeeded`
- endpoint `/download` จะคืน `download_path` ของ backend แทน signed URL
- endpoint `/file` จะ stream ไฟล์ผ่าน backend โดยไม่เผย bucket path หรือ signed URL ไปยัง client

### JavaScript

```js
const response = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/auth/public-key", {
  method: "GET",
  credentials: "include"
});

const data = await response.json();
console.log(data.publicKey);
```

## 5. Read Safe Profile For UI Binding

### cURL

```bash
curl -i https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/profile/me
```

### JavaScript

```js
const response = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/profile/me", {
  method: "GET",
  credentials: "include"
});

const data = await response.json();
console.log(data.display_name, data.student_id, data.account_type);
```

ตัวอย่าง response:

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

## 6. Fetch CSRF Token

### JavaScript

```js
const csrfResponse = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/auth/csrf-token", {
  method: "GET",
  credentials: "include"
});

const csrfData = await csrfResponse.json();
console.log(csrfData.csrf_token);
```

หมายเหตุ:

- browser/BFF client ควรเรียก endpoint นี้หลัง `GET /oidc/me`
- นำ token ที่ได้ไปใส่ใน header `x-csrf-token` ของทุก `POST`, `PUT`, `PATCH`, `DELETE`

## 7. Initialize Session

`POST /session/init` เป็น secure JSON endpoint:

- ต้องมี OIDC-backed session ก่อน
- ต้องมี `x-csrf-token`
- browser/client ต้องส่ง `application/json`
- body จริงที่ส่งผ่าน network ต้องเป็น encrypted wrapper

### Plain business body

```json
{}
```

### Transport body ที่ส่งจริง

```json
{
  "encKey": "base64-rsa-encrypted-aes-key",
  "iv": "base64-12-byte-iv",
  "tag": "base64-gcm-auth-tag",
  "payload": "base64-aes-gcm-ciphertext"
}
```

### cURL

```bash
curl -X POST https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/session/init \
  -H 'Content-Type: application/json' \
  -H 'x-csrf-token: <csrf-token>' \
  -d '{"encKey":"<base64>","iv":"<base64>","tag":"<base64>","payload":"<base64>"}'
```

### JavaScript

```js
const transportBody = {
  encKey: "<base64>",
  iv: "<base64>",
  tag: "<base64>",
  payload: "<base64>"
};

const response = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/session/init", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": csrfData.csrf_token
  },
  body: JSON.stringify(transportBody),
  credentials: "include"
});
```

## 8. Read Encrypted Personal Profile Details

plaintext body ก่อนเข้ารหัส:

```json
{
  "_ts": 1711886400000,
  "nonce": "profile-details-12345",
  "include_sensitive_personal_data": true
}
```

หมายเหตุ:

- route นี้คือ `POST /profile/details`
- ต้องใช้ secure JSON transport เหมือน `POST /session/init`
- ต้องมี authenticated session และ `x-csrf-token` ก่อน

ตัวอย่าง response หลังถอดรหัส:

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

## Recommended Browser Flow (Legacy/Direct Mode)

1. เปิด `GET /oidc/google/login?return_to=<frontend-url>`
2. frontend เรียก `GET /oidc/me` ด้วย `credentials: 'include'`
3. frontend เรียก `GET /auth/csrf-token`
4. ถ้าต้องใช้ secure JSON flow ให้เรียก `POST /session/init`
5. ค่อยเรียก endpoint ที่ต้อง auth อื่น

## Recommended Production Flow

1. browser เรียก frontend BFF `/auth/login`
2. frontend BFF ขอ Google login URL จาก backend ผ่าน `GET /oidc/bff/google/login-url`
3. Google redirect กลับ `GET /auth/callback` ของ frontend
4. frontend BFF เรียก backend `GET /oidc/bff/google/callback`
5. frontend BFF ตรวจ `GET /oidc/me`, ดึง `GET /auth/csrf-token`, แล้วค่อยเรียก `POST /session/init`
6. request business อื่นวิ่งผ่าน frontend BFF ไป backend private

## AI Usage Retention

- backend เก็บ usage รายวันใน Firestore collection `AI_USAGE_DAILY`
- retention ของข้อมูลนี้คุมผ่าน `AI_USAGE_RETENTION_DAYS`
- ระบบใช้ข้อมูลชุดนี้ทั้งสำหรับ daily token limit และการวิเคราะห์ usage ภายหลัง
