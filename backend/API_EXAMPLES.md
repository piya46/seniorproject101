# API Examples

Version: `v1.9.1`
Last updated: `2026-03-26`

ตัวอย่างด้านล่างอธิบาย flow หลักของระบบในโหมด OIDC-only

1. เปิด Google OIDC login
2. ตรวจ session ด้วย `GET /oidc/me`
3. ดึง public key
4. เริ่ม session ด้วย `POST /session/init`

## Base URL

Production:

```text
https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1
```

Health endpoint:

```text
https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/system/status

ตัวอย่าง response:

```json
{
  "status": "ok",
  "service": "sci-request-system",
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
```

Canonical Google OAuth callback:

```text
https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback
```

## 1. Open Google OIDC Login

ตัวอย่าง URL:

```text
GET https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=https://pstpyst.com
```

### Browser URL

```text
https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=https://pstpyst.com
```

### JavaScript

```js
window.location.href =
  "https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=" +
  encodeURIComponent("https://pstpyst.com");
```

### PHP

```php
<?php
$returnTo = 'https://pstpyst.com';
$url = 'https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=' . rawurlencode($returnTo);
header('Location: ' . $url, true, 302);
exit;
```

### Python

```python
from urllib.parse import quote

return_to = "https://pstpyst.com"
url = "https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/login?return_to=" + quote(return_to, safe="")
print(url)
```

## 2. Read OIDC Session Status

หลัง browser ถูก redirect กลับจาก OIDC callback ให้เรียก `GET /oidc/me` พร้อม cookie เดิม

### cURL

```bash
curl -i https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/me
```

หมายเหตุ:

- ถ้ายิงจาก terminal ที่ไม่ได้ผ่าน browser login มาก่อน อาจได้ `401`
- endpoint นี้มีประโยชน์ที่สุดเมื่อเรียกจาก browser ที่เพิ่งผ่าน login flow

### JavaScript

```js
const response = await fetch("https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/me", {
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

$body = file_get_contents('https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/me', false, $context);
echo $body;
```

### Python

```python
import requests

response = requests.get(
    "https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/me",
    allow_redirects=False,
)
print(response.status_code)
print(response.text)
```

## 3. Fetch Public Key

### cURL

```bash
curl -s https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/auth/public-key
```

### JavaScript

```js
const response = await fetch("https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/auth/public-key", {
  method: "GET",
  credentials: "include"
});

const data = await response.json();
console.log(data.publicKey);
```

## 4. Initialize Session

`POST /session/init` เป็น secure JSON endpoint:

- ต้องมี OIDC-backed session ก่อน
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
curl -X POST https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/session/init \
  -H 'Content-Type: application/json' \
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

const response = await fetch("https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/session/init", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(transportBody),
  credentials: "include"
});
```

## Recommended Browser Flow

1. เปิด `GET /oidc/google/login?return_to=<frontend-url>`
2. frontend เรียก `GET /oidc/me` ด้วย `credentials: 'include'`
3. ถ้าต้องใช้ secure JSON flow ให้เรียก `POST /session/init`
4. ค่อยเรียก endpoint ที่ต้อง auth อื่น
