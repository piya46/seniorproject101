# API Examples

Version: `v1.9.4`
Last updated: `2026-03-27`

ตัวอย่างด้านล่างอธิบาย flow หลักของระบบในโหมด OIDC-only

1. เปิด Google OIDC login
2. ตรวจ session ด้วย `GET /oidc/me`
3. ดึง CSRF token ด้วย `GET /auth/csrf-token`
4. ดึง public key
5. เริ่ม session ด้วย `POST /session/init`

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

Public storage-signing smoke probe:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/system/status/storage-signing
```

หมายเหตุ:

- endpoint นี้เป็น public smoke probe สำหรับตรวจว่า runtime ยังสร้าง signed URL ได้
- มีประโยชน์หลัง deploy หรือเวลาสงสัยปัญหา merge/download flow

Canonical Google OAuth callback:

```text
https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/oidc/google/callback
```

## 1. Open Google OIDC Login

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

## 2. Read OIDC Session Status

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

## 3. Fetch Public Key

### cURL

```bash
curl -s https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/auth/public-key
```

### JavaScript

```js
const response = await fetch("https://ai-formcheck-backend-<project-number>.asia-southeast3.run.app/api/v1/auth/public-key", {
  method: "GET",
  credentials: "include"
});

const data = await response.json();
console.log(data.publicKey);
```

## 4. Fetch CSRF Token

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

- browser client ควรเรียก endpoint นี้หลัง `GET /oidc/me`
- นำ token ที่ได้ไปใส่ใน header `x-csrf-token` ของทุก `POST`, `PUT`, `PATCH`, `DELETE`

## 5. Initialize Session

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

## Recommended Browser Flow

1. เปิด `GET /oidc/google/login?return_to=<frontend-url>`
2. frontend เรียก `GET /oidc/me` ด้วย `credentials: 'include'`
3. frontend เรียก `GET /auth/csrf-token`
4. ถ้าต้องใช้ secure JSON flow ให้เรียก `POST /session/init`
5. ค่อยเรียก endpoint ที่ต้อง auth อื่น

## AI Usage Retention

- backend เก็บ usage รายวันใน Firestore collection `AI_USAGE_DAILY`
- retention ของข้อมูลนี้คุมผ่าน `AI_USAGE_RETENTION_DAYS`
- ระบบใช้ข้อมูลชุดนี้ทั้งสำหรับ daily token limit และการวิเคราะห์ usage ภายหลัง
