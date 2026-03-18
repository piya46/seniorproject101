# Frontend Integration Guide

Version: `v1.8.0`  
Last updated: `2026-03-17`

เอกสารนี้อธิบายเฉพาะสิ่งที่ frontend ต้องทำเพื่อเชื่อมต่อกับ Sci-Request backend ให้ถูกต้อง โดยเฉพาะส่วน secure transport, session cookie, encrypted JSON request/response และ encrypted file upload

## 1. เป้าหมายของคู่มือนี้

frontend ของระบบนี้ไม่ได้ส่ง JSON ตรงไปยัง backend ทุก endpoint

backend แบ่งรูปแบบการรับส่งข้อมูลออกเป็น 2 กลุ่ม:

- `GET` และ endpoint ที่เป็น query ปกติ: ส่ง/รับ JSON ปกติ
- `POST` / `PUT` / `PATCH` ที่เป็น secure JSON endpoint: ต้องเข้ารหัส request ก่อนส่ง และบาง endpoint อาจตอบกลับแบบเข้ารหัสเช่นกัน
- `POST /upload`: ใช้ `multipart/form-data` แต่ตัวไฟล์สามารถถูกเข้ารหัสจากฝั่ง browser ก่อนอัปโหลดได้

ดังนั้นฝั่ง frontend ควรมี API client กลางที่รับผิดชอบเรื่อง:

- ดึง public key
- เริ่ม session
- แนบ cookie ทุก request
- เข้ารหัส business JSON
- ถอดรหัส encrypted response
- เข้ารหัสไฟล์ก่อนอัปโหลด

ไม่ควรให้ UI component ประกอบ `encKey`, `iv`, `tag`, `payload` เอง

## 2. ภาพรวมสถาปัตยกรรมการเข้ารหัส

ระบบใช้ hybrid encryption:

- ใช้ `RSA-OAEP` พร้อม `SHA-256` เพื่อเข้ารหัส AES key
- ใช้ `AES-256-GCM` เพื่อเข้ารหัส business payload หรือไฟล์

แนวคิดคือ:

1. frontend ขอ public key จาก backend
2. frontend สร้าง AES key ใหม่ต่อ request
3. frontend ใช้ AES key เข้ารหัส payload จริง
4. frontend ใช้ RSA public key ของ backend เข้ารหัส AES key
5. backend ใช้ RSA private key ถอด AES key แล้วค่อยถอด business payload อีกชั้น

ข้อดีของ model นี้:

- payload ไม่ถูกส่งเป็น plaintext บน transport layer ของ application
- แต่ละ request ใช้ AES key คนละชุด ลดความเสี่ยงจาก key reuse
- AES-GCM มี integrity check ในตัวผ่าน authentication tag

## 3. ลำดับการเริ่มต้นฝั่ง Frontend

ลำดับมาตรฐานที่ควรใช้:

1. เรียก `GET /auth/public-key`
2. import public key เข้าสู่ Web Crypto
3. เรียก `POST /session/init`
4. ให้ browser เก็บ cookie session
5. ทุก request หลังจากนี้ต้องส่งด้วย `credentials: 'include'`
6. secure JSON endpoint ต้องถูกเรียกผ่าน encryption layer เท่านั้น

ถ้าข้าม `POST /session/init`:

- upload จะไม่ผูกกับ session ที่ถูกต้อง
- validation / merge / chat / forms บาง endpoint จะตอบ `401` หรือ `403`

### 3.1 Production Flow เมื่อมี IAP อยู่หน้า `api.pstpyst.com`

ถ้าสถาปัตยกรรมเป็น:

- frontend = `https://pstpyst.com`
- backend = `https://api.pstpyst.com`

ให้ใช้ flow นี้:

1. frontend พาผู้ใช้ไป `GET /iap/complete?return_to=<frontend-url>`
2. IAP login จะเกิดบน backend domain (`api.pstpyst.com`)
3. backend จะสร้าง `sci_session_token`
4. backend redirect กลับ frontend พร้อม query `auth=ok`
5. frontend เรียก `GET /iap/me` ด้วย `credentials: 'include'`
6. backend ตอบ `authenticated`, `email`, `hosted_domain`

ข้อสำคัญ:

- ไม่ควรส่ง email, token หรือ session id ผ่าน query string
- ไม่ควรใช้ flow ที่ให้ IAP redirect ข้าม host ไป frontend ตรงโดยไม่มีขั้น backend completion

## 4. Session และ Cookie

backend ใช้ cookie-based session โดยตั้ง cookie ชื่อ `sci_session_token`

frontend ต้อง:

- ใช้ `credentials: 'include'` ถ้าเรียกผ่าน `fetch`
- ใช้ `withCredentials: true` ถ้าเรียกผ่าน `axios`

สิ่งสำคัญ:

- อย่าอ่าน cookie นี้จาก JavaScript เพื่อเอาไปแนบ header เอง
- ปล่อยให้ browser จัดการ cookie ให้
- การคง session จะขึ้นกับโดเมน, protocol และ `sameSite` policy ของ environment นั้น

ตัวอย่าง `fetch`:

```ts
await fetch(`${baseUrl}/forms`, {
  method: "GET",
  credentials: "include",
});
```

## 5. Business Body กับ Transport Body

### 5.1 Business body คืออะไร

business body คือข้อมูลที่ UI หรือ state manager ต้องการส่งจริง เช่น:

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null
}
```

frontend ควรคิดเฉพาะข้อมูล business ระดับนี้

### 5.2 Plaintext body ก่อนเข้ารหัส

ก่อนเข้ารหัส frontend ต้องเติม field ควบคุม transport เพิ่มเอง:

- `_ts`
- `nonce`

ตัวอย่าง:

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null,
  "_ts": 1710000000000,
  "nonce": "req-1710000000000-x8f4ab"
}
```

ความหมาย:

- `_ts` คือ request timestamp ใช้ช่วยกัน replay และช่วย trace/debug
- `nonce` คือ request identifier ที่ไม่ควรซ้ำในแต่ละ request

### 5.3 Transport wrapper ที่ส่งจริง

เมื่อเข้ารหัสเสร็จ body ที่ส่งจริงจะไม่ใช่ business JSON ด้านบน แต่เป็น wrapper:

```json
{
  "encKey": "base64-rsa-encrypted-aes-key",
  "iv": "base64-12-byte-iv",
  "tag": "base64-gcm-auth-tag",
  "payload": "base64-aes-gcm-ciphertext"
}
```

คำอธิบาย:

- `encKey` คือ AES key ที่ถูกเข้ารหัสด้วย RSA public key ของ backend
- `iv` คือ initialization vector ของ AES-GCM
- `tag` คือ authentication tag ของ AES-GCM
- `payload` คือ ciphertext ของ plaintext body

## 6. Secure JSON Request Flow แบบละเอียด

ทุกครั้งที่เรียก `POST` / `PUT` / `PATCH` ที่เป็น secure JSON endpoint ให้ทำลำดับนี้:

1. เตรียม business body
2. เติม `_ts = Date.now()`
3. เติม `nonce`
4. สร้าง AES key ใหม่ขนาด 256-bit
5. สร้าง IV ใหม่ขนาด 12 bytes
6. `JSON.stringify` plaintext body
7. เข้ารหัสด้วย `AES-GCM`
8. แยก ciphertext กับ tag ออกจากผลลัพธ์
9. export AES key ออกมาเป็น raw bytes
10. เข้ารหัส AES key ด้วย `RSA-OAEP` และ `SHA-256`
11. แปลงทุก field เป็น base64
12. ส่ง wrapper ผ่าน `Content-Type: application/json`

สิ่งที่ต้องระวัง:

- ห้าม reuse AES key ระหว่าง request
- ห้าม reuse IV
- ห้าม reuse `nonce`
- ห้ามส่ง business body เป็น plaintext ไปยัง secure endpoint

## 7. Secure JSON Response Flow แบบละเอียด

บาง endpoint อาจตอบกลับมาเป็น encrypted response เพื่อให้ response body ถูกป้องกันแบบเดียวกับ request

เมื่อได้ response กลับมา:

1. parse response JSON ก่อน
2. ถ้ามี `iv`, `tag`, `payload` ให้ถือว่าเป็น encrypted response
3. ใช้ AES key ของ request เดิมเท่านั้นในการถอดรหัส
4. นำ `payload + tag` มาประกอบกันเป็น AES-GCM ciphertext เต็ม
5. ถอดรหัสด้วย IV เดิมของ response
6. `JSON.parse` ข้อความที่ถอดออกมาได้
7. ส่ง object ที่ถอดรหัสแล้วต่อให้ UI

หลักสำคัญ:

- response ต้องถูกจับคู่กับ request context เดิม
- ถ้าคุณเก็บ pending request หลายตัวพร้อมกัน ต้องไม่สลับ AES key ข้าม request

ถ้าถอดรหัสไม่ผ่าน:

- ให้ถือว่า response ใช้งานไม่ได้
- อย่านำข้อมูลไปแสดงผลต่อ
- log เฉพาะ metadata ที่ปลอดภัย เช่น endpoint, nonce, status code

## 8. Endpoint ไหนเข้ารหัส และ endpoint ไหนไม่เข้ารหัส

### 8.1 เข้ารหัส

ใช้ encrypted JSON transport สำหรับ:

- `POST /session/init`
- `POST /validation/check-completeness`
- `POST /documents/merge`
- `POST /chat/recommend`
- endpoint อื่นในอนาคตที่เป็น JSON `POST` / `PUT` / `PATCH` และอยู่หลัง secure middleware เดียวกัน

### 8.2 ไม่เข้ารหัสแบบ secure JSON wrapper

- `GET /auth/public-key`
- `GET /departments`
- `GET /forms`
- `GET /forms/:form_code`
- `POST /upload` เพราะเป็น `multipart/form-data`

หมายเหตุ:

- `POST /upload` ไม่ใช้ wrapper JSON
- แต่ไฟล์ที่อยู่ใน field `file` สามารถถูกเข้ารหัสด้วย AES-GCM ก่อนส่งได้

### 8.3 Endpoint Matrix

ตารางนี้สรุป endpoint หลักทั้งหมดที่ frontend ใช้งานร่วมกับระบบปัจจุบัน

| Endpoint | Method | ต้อง Auth | ต้อง Encryption | Request business fields | Response หลัก |
| --- | --- | --- | --- | --- | --- |
| `/auth/public-key` | `GET` | ไม่ต้อง | ไม่ต้อง | ไม่มี | `{ publicKey }` |
| `/session/init` | `POST` | ไม่ต้อง | ต้อง | ไม่มี หรือ `{}` | `{ message, session_id }` และตั้ง cookie session |
| `/departments` | `GET` | ต้อง | ไม่ต้อง | ไม่มี | `{ data: Department[] }` |
| `/forms` | `GET` | ต้อง | ไม่ต้อง | query: `degree_level` | `{ data: FormSummary[] }` |
| `/forms/:form_code` | `GET` | ต้อง | ไม่ต้อง | query: `degree_level`, `sub_type` | `FormDetail` พร้อม `required_documents`, `approval_requirements`, `case_rules` แบบ safe สำหรับ frontend |
| `/upload` | `POST multipart/form-data` | ต้อง | ไม่ใช้ secure JSON wrapper แต่รองรับ encrypted file | `file`, `file_key`, `form_code?`, `encKey`, `iv`, `tag` | `{ status, data: { file_key, form_code } }` |
| `/validation/check-completeness` | `POST` | ต้อง | ต้อง | `form_code`, `degree_level`, `sub_type`, `case_key?` | ผลตรวจราย `file_key` เช่น `status`, `reason`, `confidence` |
| `/documents/merge` | `POST` | ต้อง | ต้อง | `form_code`, `degree_level`, `sub_type` | `{ status, download_url, instruction }` |
| `/chat/recommend` | `POST` | ต้อง | ต้อง | `message`, `degree_level` | ข้อความตอบกลับและอาจมีฟอร์มที่แนะนำ |
หมายเหตุสำคัญ:

- `session/init` เป็น `POST` ที่ต้องเข้ารหัสเหมือน secure endpoint อื่น
- `upload` ต้องใช้ cookie session แต่ body ไม่ได้เป็น encrypted JSON wrapper
- ถ้า `upload` มาจาก browser และมี `Origin` หรือ `Referer` backend จะตรวจให้ตรงกับ frontend allowlist
- `forms` และ `forms/:form_code` ใช้ query string แทน body
- `validation`, `merge`, `chat` ใช้ `degree_level` เหมือนกันทั้งหมด
- ฝั่ง frontend product ไม่ต้องแสดงฟอร์มหรือเมนูสำหรับ `support/technical-email` โดยตรง แต่ยังต้องแสดงอีเมลปลายทางของ flow ปกติ เช่น `instruction.target_email` หรืออีเมลภาควิชาที่ใช้ส่งคำร้องต่อให้ผู้ใช้ทั่วไปเห็น

### 8.4 Error Response Contract กลาง

backend ไม่ได้ตอบ error ทุกรูปแบบด้วย schema เดียวกัน 100% แต่รูปแบบที่ frontend ควรรองรับมีชุดหลักดังนี้

#### 8.4.1 Error shape ที่พบบ่อย

รูปแบบที่พบบ่อยที่สุด:

```json
{
  "error": "ข้อความสรุปสั้น",
  "message": "ข้อความอธิบายเพิ่มเติม"
}
```

บาง endpoint อาจตอบ:

```json
{
  "status": "error",
  "message": "รายละเอียดปัญหา"
}
```

บาง endpoint อาจมี field เฉพาะเพิ่ม เช่น:

```json
{
  "error": "Incomplete documents",
  "missing_keys": ["main_form", "citizen_id_copy"]
}
```

ดังนั้น frontend ควรอ่าน error message ตามลำดับนี้:

1. `message`
2. `error`
3. fallback เป็นข้อความทั่วไปตาม status code

#### 8.4.2 ตารางสถานะที่ควรรองรับ

| Status | ความหมายโดยทั่วไป | รูปแบบ field ที่มักพบ | ตัวอย่างกรณี |
| --- | --- | --- | --- |
| `400` | request ไม่ถูกต้องหรือข้อมูลไม่ครบ | `error`, `message`, `missing_keys`, `status` | ไม่มีไฟล์, form ไม่ครบ, merge ไม่ครบเอกสาร |
| `401` | ไม่มี session หรือ session ไม่ผ่าน auth | `error` หรือ `message` | ไม่ส่ง cookie, cookie หมดอายุ |
| `403` | ไม่มีสิทธิ์หรือ request ไม่ผ่าน policy | `error` หรือ `message` | session ไม่ถูกต้อง, policy บางอย่างไม่ผ่าน |
| `404` | ไม่พบ resource/config | `error`, `message`, `status` | ไม่พบ form code หรือ sub type ที่ระบุ |
| `429` | ยิงบ่อยเกิน rate limit | `error`, `message` | upload ถี่เกิน, secure endpoint ถี่เกิน |
| `500` | backend ล้มเหลว | `error`, `message` | merge ล้มเหลว, session init ล้มเหลว, storage ล้มเหลว |

#### 8.4.3 แนวทางที่ frontend ควรทำ

- ถ้ามี `missing_keys` ให้ map กลับไปยังรายการเอกสารที่หน้าจอทันที
- ถ้าเป็น `401/403` ให้ลอง `initSession` ใหม่หนึ่งครั้งก่อน
- ถ้าเป็น `429` ให้แสดงข้อความให้ user รอสักครู่แทนการ retry รัว
- ถ้าเป็น `500` ให้เก็บ `nonce`, endpoint, status ไว้สำหรับ debug

### 8.4.4 Success Response Contract กลาง

backend ก็ไม่ได้มี success schema เดียวทั้งระบบเช่นกัน แต่สามารถสรุปเป็นกลุ่มหลักให้ frontend ใช้ทำ type design ได้

#### a. Simple JSON success

ใช้กับ endpoint ที่ตอบ object ตรงๆ เช่น session init:

```json
{
  "message": "Session initialized",
  "session_id": "sess_xxxxxxxxxxxxxxxx"
}
```

frontend ควรใช้ response นี้เพื่อ:

- รู้ว่า session init สำเร็จ
- แต่ไม่ต้องเอา `session_id` ไปแนบ request เอง เพราะตัวจริงที่ใช้ auth คือ cookie

#### b. List response

ใช้กับ endpoint แบบ list:

```json
{
  "data": [
    {
      "id": "math_ug",
      "name_th": "คณิตศาสตร์ (ป.ตรี)",
      "email": "..."
    }
  ]
}
```

ใช้กับ:

- `GET /departments`
- `GET /forms`

#### c. Detail response

ใช้กับ endpoint detail:

```json
{
  "form_code": "JT41",
  "name_th": "จท.41 คำร้องทั่วไป",
  "sub_type": "late_reg",
  "submission_location": "...",
  "submission_steps": ["..."],
  "required_documents": [
    {
      "key": "main_form",
      "label": "คำร้อง จท.41",
      "required": true
    }
  ]
}
```

ใช้กับ:

- `GET /forms/:form_code`

จุดสำคัญ:

- response นี้เป็น source of truth สำหรับ render checklist เอกสาร
- `required_documents` ที่ส่งให้ frontend เป็นเวอร์ชัน safe แล้ว

#### d. Validation result

ผลลัพธ์จะเป็น object ราย `file_key` ไม่ใช่ array:

```json
{
  "main_form": {
    "status": "valid",
    "reason": "เอกสารถูกต้องครบถ้วน",
    "confidence": "high"
  },
  "medical_cert": {
    "status": "invalid",
    "reason": "ไม่พบวันที่ครอบคลุมวันสอบ",
    "confidence": "medium"
  }
}
```

ใช้กับ:

- `POST /validation/check-completeness`

frontend ควร:

- iterate โดยใช้ key ของ object
- ไม่ assume ว่าจะมีเฉพาะเอกสารที่ required เสมอ เพราะอาจมีไฟล์ `general` ถูกพิจารณาร่วมด้วย

#### e. Merge result

```json
{
  "status": "success",
  "download_url": "https://...",
  "instruction": {
    "target_email": "department@example.com",
    "email_subject": "ยื่นคำร้อง ..."
  }
}
```

ใช้กับ:

- `POST /documents/merge`

frontend ควร:

- แสดงปุ่มดาวน์โหลดจาก `download_url`
- แสดงข้อมูลส่งต่อจาก `instruction.target_email` และ `instruction.email_subject`
- ถ้า merge ตอบ `400` พร้อม `details` ให้ถือว่าไฟล์ใน session มีปัญหาเชิง parse/merge และควรให้ผู้ใช้ re-upload เอกสารที่เกี่ยวข้อง

#### f. Chat result

chat endpoint อาจตอบ field ได้มากกว่าหนึ่งรูปแบบ เช่น:

```json
{
  "reply": "ควรใช้ จท.41 ประเภทย่อย ...",
  "recommended_form": "JT41"
}
```

หรือ:

```json
{
  "text": "..."
}
```

frontend ควรอ่าน fallback ตามลำดับ:

1. `reply`
2. `text`
3. stringify object ถ้ายังไม่เจอ field ที่รู้จัก

#### g. ตารางสรุป success shape

| Endpoint | Success contract หลัก |
| --- | --- |
| `GET /auth/public-key` | `{ publicKey }` |
| `POST /session/init` | `{ message, session_id }` |
| `GET /departments` | `{ data: Department[] }` |
| `GET /forms` | `{ data: FormSummary[] }` |
| `GET /forms/:form_code` | `FormDetail` พร้อม `approval_requirements`, `case_rules` |
| `POST /upload` | `{ status, data: { file_key, form_code } }` |
| `POST /validation/check-completeness` | `Record<file_key, { status, reason, confidence }>` โดย backend อาจใช้ `case_key` ประกอบการให้เหตุผล |
| `POST /documents/merge` | `{ status, download_url, instruction }` |
| `POST /chat/recommend` | `{ reply? , text? , recommended_form? }` |
### 8.5 Field Dictionary

ตารางนี้สรุป field ที่ทีม frontend ชอบสับสนและควรใช้ความหมายเดียวกันทั้งทีม

| Field | อยู่ใน endpoint ไหนบ้าง | ความหมาย | หมายเหตุ |
| --- | --- | --- | --- |
| `degree_level` | `GET /forms`, `GET /forms/:form_code`, `POST /validation/check-completeness`, `POST /documents/merge`, `POST /chat/recommend` | ระดับการศึกษา เช่น `bachelor`, `graduate` | ใช้ชื่อนี้แล้วทั้งระบบ |
| `case_key` | `POST /validation/check-completeness` | key ของกรณีย่อยใน `case_rules` เช่น `before_exam`, `during_exam` | ส่งเมื่อ form/subtype นั้นมี `case_rules` และต้องการตรวจตามกรณีเฉพาะ |
| `form_code` | detail, validation, merge, upload | รหัสคำร้อง เช่น `JT31`, `JT41`, `JT44` | เป็น key หลักของ flow |
| `sub_type` | form detail, validation, merge | ประเภทย่อยของฟอร์ม เช่น `late_reg`, `change_section` | ใช้กับฟอร์มที่มี subtype เช่น `JT41` |
| `file_key` | upload, validation result, merge logic | key ของเอกสาร เช่น `main_form`, `transcript` | backend เลือกไฟล์ล่าสุดต่อ `file_key` |
| `general` | logic ฝั่ง backend เวลาเลือกไฟล์ | กลุ่มไฟล์กลางที่ใช้ได้ข้ามหลายฟอร์ม | frontend ไม่ต้องส่ง field ชื่อนี้ตรงๆ แต่ควรเข้าใจว่า validation อาจดึงมาใช้ |
| `required_documents` | `GET /forms/:form_code` | รายการเอกสารที่ frontend ต้องแสดงให้ user อัปโหลด | response ที่ส่งให้ frontend ตัด `validation_criteria` ออกแล้ว |
| `approval_requirements` | `GET /forms/:form_code`, `case_rules[]` | รายการผู้ที่ต้องให้ความเห็นหรือการลงนาม | ใช้แสดง checklist ก่อน submit และช่วยอธิบายลายเซ็นที่ควรมีในเอกสาร |
| `case_rules` | `GET /forms/:form_code` | รายการกรณีย่อยที่ใช้ตรรกะเดียวกับ form เดิม แต่มี approval/hint ต่างกัน | public response จะส่งเฉพาะ `key`, `label`, `note`, `approval_requirements` |
| `instruction.download_url` | ไม่มี field ชื่อนี้ตรงๆ | แนวคิดหมายถึง URL ที่ใช้ดำเนินการต่อหลัง merge | ใน response จริงของ merge ใช้ `download_url` ที่ root object |
| `instruction.target_email` | `POST /documents/merge` | อีเมลปลายทางที่ user ควรส่งคำร้องต่อ | อยู่ใน object `instruction` |
| `instruction.email_subject` | `POST /documents/merge` | subject ที่แนะนำให้ใช้ตอนส่งอีเมล | อยู่ใน object `instruction` |
| `_ts` | plaintext ก่อนเข้ารหัส | request timestamp | encryption layer เติมให้ ไม่ใช่ business field |
| `nonce` | plaintext ก่อนเข้ารหัส | request id ที่ไม่ควรซ้ำ | encryption layer เติมให้ |
| `encKey` | encrypted request/upload | AES key ที่ถูก RSA encrypt | frontend layer จัดการให้ |
| `iv` | encrypted request/upload/response | initialization vector ของ AES-GCM | frontend layer จัดการให้ |
| `tag` | encrypted request/upload/response | auth tag ของ AES-GCM | frontend layer จัดการให้ |
| `payload` | encrypted request/response | ciphertext ของ JSON business body | ไม่ควรถูกสร้างจาก UI component โดยตรง |

### 8.6 Frontend State Flow

frontend ควรมี state กลางอย่างน้อยสำหรับ flow ต่อไปนี้

| State | ชนิดข้อมูลที่แนะนำ | ใช้ทำอะไร | อัปเดตเมื่อไร |
| --- | --- | --- | --- |
| `publicKey` | `CryptoKey | null` | ใช้ encrypt request/file | หลัง `GET /auth/public-key` สำเร็จ |
| `sessionReady` | `boolean` | บอกว่า session cookie พร้อมใช้งานแล้วหรือยัง | หลัง `POST /session/init` สำเร็จ |
| `currentFormCode` | `string | null` | track ฟอร์มที่ user เลือก | เมื่อ user เลือกคำร้อง |
| `degreeLevel` | `string` | ใช้ query forms และยิง secure endpoint | เมื่อ user เลือกระดับการศึกษา |
| `subType` | `string | null` | ใช้กับฟอร์มย่อย เช่น JT41 | เมื่อ user เลือก subtype |
| `selectedCaseKey` | `string | null` | เก็บกรณีย่อยที่ user เลือกจาก `case_rules` | ส่งต่อใน `check-completeness` เมื่อ form ต้องแยกการตรวจตามกรณี |
| `uploadedFiles` | `Record<string, UploadedFileState>` หรือ `Map<string, UploadedFileState>` | เก็บสถานะของไฟล์ล่าสุดต่อ `file_key` | หลัง upload สำเร็จ/ล้มเหลว |
| `latestValidationResult` | `Record<string, ValidationItem> | null` | เก็บผลตรวจรอบล่าสุด | หลัง `check-completeness` สำเร็จ |
| `mergeResult` | `MergeResult | null` | เก็บ `download_url` และ `instruction` | หลัง `documents/merge` สำเร็จ |
| `chatHistory` | `ChatMessage[]` | แสดงบทสนทนา | ทุกครั้งที่ส่ง/รับข้อความ |
| `pendingRequests` | `Record<string, PendingRequestMeta>` | ช่วยจับคู่ nonce, loading state, error | ตอนยิง request และลบออกเมื่อเสร็จ |

แนวทางการออกแบบ state:

- อย่าเก็บ AES key ไว้ใน global state ถาวรนานเกินจำเป็น
- ถ้าต้องเก็บ request context ชั่วคราว ให้เก็บอยู่ใน scope ของ request นั้น
- `uploadedFiles` ควรแทนหนึ่ง `file_key` ต่อหนึ่งไฟล์ล่าสุด เพื่อให้ตรงกับ behavior ของ backend

ตัวอย่างโครงสร้าง `uploadedFiles`:

```ts
type UploadedFileState = {
  fileKey: string;
  formCode?: string;
  originalName: string;
  uploadedAt: string;
  status: "uploading" | "ready" | "error";
};
```

### 8.7 Sequence แบบ Step-by-Step

#### 8.7.1 เริ่มระบบ

1. app boot
2. เรียก `GET /auth/public-key`
3. import public key
4. เรียก `POST /session/init`
5. ตั้ง `sessionReady = true`
6. โหลดข้อมูลพื้นฐาน เช่น `departments`, `forms`

#### 8.7.2 เลือกฟอร์ม

1. user เลือกระดับการศึกษา
2. frontend เรียก `GET /forms?degree_level=...`
3. user เลือก `form_code`
4. frontend เรียก `GET /forms/:form_code?degree_level=...&sub_type=...`
5. เก็บ `currentFormCode`, `degreeLevel`, `subType`
6. render `required_documents`

#### 8.7.3 อัปโหลดเอกสาร

1. user เลือกไฟล์ของเอกสารแต่ละ `file_key`
2. frontend เข้ารหัสไฟล์ด้วย AES-GCM
3. frontend เข้ารหัส AES key ด้วย RSA public key
4. frontend ส่ง `multipart/form-data` ไป `POST /upload`
5. ถ้าสำเร็จให้ update `uploadedFiles[file_key]`
6. ถ้าอัปโหลดซ้ำด้วย `file_key` เดิม ให้ frontend ถือว่าเป็น replace ไฟล์เดิม

#### 8.7.4 ตรวจความครบถ้วน

1. frontend สร้าง business body จาก `form_code`, `degree_level`, `sub_type`
2. ถ้า form detail มี `case_rules` และ user เลือกกรณีเฉพาะ ให้ใส่ `case_key`
3. encryption layer เติม `_ts`, `nonce`
4. frontend ยิง `POST /validation/check-completeness`
5. backend ตรวจจากไฟล์ล่าสุดต่อ `file_key` และใช้ `case_key` ประกอบถ้ามี
6. frontend เก็บผลไว้ใน `latestValidationResult`
7. map ผลลัพธ์กลับไปแสดงรายเอกสารใน UI

#### 8.7.5 Merge

1. frontend สร้าง business body สำหรับ merge
2. ยิง `POST /documents/merge`
3. backend รวมไฟล์ล่าสุดของ required documents
4. frontend รับ `download_url`
5. frontend แสดงปุ่มดาวน์โหลดและข้อมูลใน `instruction`

#### 8.7.6 Chat

1. user ส่งข้อความ
2. frontend ยิง `POST /chat/recommend`
3. encryption layer จัดการ request/response
4. frontend เพิ่มข้อความ user และ bot ลง `chatHistory`
5. ถ้ามีคำแนะนำฟอร์ม ให้ผูกกลับไปยัง flow เลือกฟอร์มได้

### 8.8 JT41 Subtype Flows

ตารางนี้สรุปเฉพาะ `JT41` subtype ที่ใช้งานบ่อยและมีผลกับ frontend ชัดเจน

| Subtype | จุดประสงค์ | Required documents หลัก | Field สำคัญที่ frontend ต้องส่ง | สิ่งที่ UI ควรเน้น |
| --- | --- | --- | --- | --- |
| `late_reg` | ขอลงทะเบียนเรียนหลังกำหนด / เพิ่มรายวิชาหลังกำหนด | `main_form`, `faculty_doc`, `cr54` (optional) | `form_code=JT41`, `degree_level`, `sub_type=late_reg` | เน้นคำอธิบายกำหนดเวลา 2 สัปดาห์แรกของภาคการศึกษา และแสดงว่า `cr54` เป็นเอกสารเสริม |
| `change_section` | ขอเปลี่ยนตอนเรียนหลังกำหนด | `main_form`, `cr54` | `form_code=JT41`, `degree_level`, `sub_type=change_section` | เน้นว่าคำร้องต้องมีลายเซ็นอาจารย์ผู้สอนทั้งตอนเดิมและตอนใหม่ |
| `cross_faculty` | ขอลงทะเบียนเรียนข้ามคณะ | `main_form`, `faculty_approval`, `cr54` | `form_code=JT41`, `degree_level`, `sub_type=cross_faculty` | เน้นหลักฐานการยินยอมจากคณะเจ้าของวิชา และใช้ `cr54` เป็นหลักฐานประกอบ |
| `credit_limit` | ขอลงทะเบียนเกิน/ต่ำกว่าจำนวนหน่วยกิตที่กำหนด | `main_form`, `transcript`, `cr54` | `form_code=JT41`, `degree_level`, `sub_type=credit_limit` | เน้นเหตุผลความจำเป็น, transcript และสถานะลงทะเบียนล่าสุด |

#### 8.8.1 JT41 `late_reg`

business body:

```json
{
  "form_code": "JT41",
  "degree_level": "bachelor",
  "sub_type": "late_reg"
}
```

frontend flow:

1. user เลือก `JT41`
2. user เลือก subtype `late_reg`
3. frontend เรียก `GET /forms/JT41?degree_level=...&sub_type=late_reg`
4. render เอกสาร `main_form`, `faculty_doc`, และ `cr54`
5. ถ้ามี upload ซ้ำของ `main_form` หรือ `faculty_doc` ให้ถือว่า replace
6. ยิง validation และ merge ด้วย subtype เดิม

หมายเหตุ:

- subtype นี้มี condition เรื่องกรอบเวลา 2 สัปดาห์แรกของภาคการศึกษา
- ควรแสดง note นี้ในหน้า UI ชัดเจน

#### 8.8.2 JT41 `change_section`

business body:

```json
{
  "form_code": "JT41",
  "degree_level": "bachelor",
  "sub_type": "change_section"
}
```

frontend flow:

1. โหลด form detail ด้วย subtype `change_section`
2. render เอกสาร `main_form` และ `cr54`
3. ใน UI ควรบอก user ว่าคำร้องต้องมีลายเซ็นอาจารย์ทั้งตอนเดิมและตอนใหม่
4. หลัง upload ครบให้ยิง validation
5. ถ้าผ่านค่อย merge เพื่อให้ user ดาวน์โหลดชุดเอกสารรวม

#### 8.8.3 JT41 `cross_faculty`

business body:

```json
{
  "form_code": "JT41",
  "degree_level": "bachelor",
  "sub_type": "cross_faculty"
}
```

frontend flow:

1. โหลด form detail ด้วย subtype `cross_faculty`
2. render `main_form`, `faculty_approval`, `cr54`
3. อธิบายให้ user เข้าใจว่า `faculty_approval` อาจเป็นอีเมลอนุมัติหรือหลักฐานจากคณะเจ้าของวิชา
4. ยิง validation
5. ถ้า merge สำเร็จให้แสดง `download_url` และข้อมูล `instruction`

#### 8.8.4 JT41 `credit_limit`

business body:

```json
{
  "form_code": "JT41",
  "degree_level": "bachelor",
  "sub_type": "credit_limit"
}
```

frontend flow:

1. โหลด form detail ด้วย subtype `credit_limit`
2. render `main_form`, `transcript`, `cr54`
3. อธิบายว่าต้องใช้ transcript เพื่อประกอบการพิจารณา GPAX
4. ยิง validation
5. ยิง merge เมื่อเอกสารครบและผ่านการตรวจแล้ว

#### 8.8.5 แนวทาง state สำหรับ JT41

เมื่อ user อยู่ใน flow ของ `JT41` ควร bind state แบบนี้อย่างน้อย:

- `currentFormCode = "JT41"`
- `subType = "late_reg" | "change_section" | "cross_faculty" | "credit_limit" | ...`
- `requiredDocuments` ต้อง reload ใหม่ทุกครั้งที่ `subType` เปลี่ยน
- `uploadedFiles` ควร reset เฉพาะเมื่อเปลี่ยน subtype แล้วเอกสารคนละชุดกัน
- `latestValidationResult` ควรถูกผูกกับคู่ `form_code + sub_type`

## 9. Encrypted File Upload

### 9.1 แนวคิด

`POST /upload` ใช้ `multipart/form-data` และรองรับ client-side encrypted file upload

frontend ต้อง:

1. อ่าน bytes ของไฟล์
2. สร้าง AES key ใหม่
3. สร้าง IV ใหม่
4. เข้ารหัสไฟล์ด้วย `AES-GCM`
5. แยก ciphertext กับ tag
6. เข้ารหัส AES key ด้วย RSA public key
7. ส่ง ciphertext เป็น field `file`
8. ส่ง metadata เสริมเป็น form-data fields

### 9.2 Field ที่ต้องส่ง

- `file`: ไฟล์ ciphertext
- `file_key`: logical document key เช่น `main_form`, `transcript`, `medical_cert`
- `form_code`: optional สำหรับผูกไฟล์กับฟอร์ม
- `encKey`: AES key ที่เข้ารหัสด้วย RSA แล้ว
- `iv`: base64 IV
- `tag`: base64 GCM tag

### 9.3 ตัวอย่างการทำงาน

ฝั่ง browser:

1. ผู้ใช้เลือกไฟล์ PDF/JPG/PNG
2. client เข้ารหัสไฟล์ก่อน
3. client ส่ง multipart ไป backend
4. backend ถอดรหัสไฟล์
5. backend sanitize และตรวจประเภทไฟล์
6. backend upload ไป storage
7. backend เก็บ metadata ไว้ใน session files

### 9.4 พฤติกรรมไฟล์ล่าสุด

ตอนนี้ backend ใช้กฎเดียวกันทั้ง `upload`, `validation`, `merge`

ความหมายคือ:

- ถ้าอัปโหลดไฟล์ใหม่ด้วย `file_key` และ `form_code` เดิมใน session เดิม
- backend จะถือว่าเป็นการแทนที่ไฟล์เดิม
- record เก่าและไฟล์เก่าจะถูกลบก่อนบันทึกไฟล์ใหม่
- `validation` และ `merge` จะเลือกใช้เฉพาะไฟล์ล่าสุดต่อ `file_key`

ดังนั้น frontend ควรสื่อสารกับผู้ใช้ชัดเจนว่า:

- การอัปโหลดซ้ำคือ replace
- ไม่ใช่การเก็บ version หลายไฟล์ไว้ตรวจพร้อมกัน

## 10. รูปแบบ API Client ที่แนะนำ

แนะนำให้ frontend มี abstraction กลางประมาณนี้:

- `fetchPublicKey()`
- `initSession()`
- `get()`
- `postEncrypted()`
- `putEncrypted()`
- `patchEncrypted()`
- `uploadEncryptedFile()`
- `encryptJsonPayload()`
- `decryptJsonResponse()`

ข้อแนะนำเชิงโครงสร้าง:

- แยก networking ออกจาก component
- แยก crypto helper ออกจาก UI
- ให้ API client เป็นคนรับผิดชอบ `credentials: 'include'`
- ให้ request context ถือ AES key ของ request นั้นจนกว่าจะถอด response เสร็จ

## 11. ตัวอย่าง Flow ตาม Use Case

### 11.1 App initialization

1. หน้าเว็บโหลด
2. API client ดึง public key
3. API client เรียก `POST /session/init`
4. browser เก็บ cookie
5. หน้า form สามารถเรียก `GET /forms` ได้

### 11.2 Validation flow

1. ผู้ใช้เลือก `form_code`
2. frontend ดึงรายการเอกสารที่ต้องใช้จาก `GET /forms/:form_code`
3. ผู้ใช้อัปโหลดเอกสารทีละ `file_key`
4. เมื่อเอกสารครบ frontend เรียก `POST /validation/check-completeness`
5. body ที่ส่งเป็น business body เช่น:

```json
{
  "form_code": "JT41",
  "degree_level": "bachelor",
  "sub_type": "late_reg"
}
```

6. encryption layer จะเติม `_ts` กับ `nonce` แล้วเข้ารหัสให้
7. backend จะใช้เฉพาะไฟล์ล่าสุดต่อ `file_key`
8. frontend ถอดรหัส response ถ้าจำเป็น แล้วแสดงผลรายเอกสาร

### 11.3 Merge flow

1. หลัง validation ผ่านหรือผู้ใช้ต้องการรวมไฟล์
2. frontend เรียก `POST /documents/merge`
3. business body ระบุ `form_code`, `degree_level`, `sub_type`
4. backend รวมไฟล์ล่าสุดของเอกสารที่จำเป็น
5. backend ตอบ URL สำหรับดาวน์โหลด PDF ที่ merge แล้ว

### 11.4 Chat flow

1. ผู้ใช้พิมพ์คำถาม
2. frontend เรียก `POST /chat/recommend`
3. business body:

```json
{
  "message": "ต้องการลงทะเบียนเรียนช้าต้องใช้ฟอร์มอะไร",
  "degree_level": "bachelor"
}
```

4. encryption layer จัดการ transport ให้
5. frontend แสดงข้อความตอบกลับหลังถอดรหัสแล้ว

## 12. ข้อกำหนดเชิง implementation ที่ควรถือเป็นมาตรฐาน

### 12.1 ใช้ public key cache ได้ แต่ต้อง refresh ได้

public key ของ backend สามารถ cache ใน memory ได้

แต่ควรมีแผน fallback เช่น:

- ถ้า encrypt ไม่สำเร็จ
- ถ้า backend rotate key
- ให้ fetch public key ใหม่แล้ว retry ได้หนึ่งครั้ง

### 12.2 ใช้ AES key ต่อ request เท่านั้น

ไม่ควรแชร์ AES key ระหว่าง:

- คนละ endpoint
- คนละ request
- คนละ browser tab

### 12.3 ใช้ IV 12 bytes สำหรับ AES-GCM

เพื่อให้สอดคล้องกับ implementation ปัจจุบันและมาตรฐานของ Web Crypto

### 12.4 เก็บ request metadata ที่ debug ได้

อย่างน้อยควร trace:

- endpoint
- method
- nonce
- `_ts`
- status code
- request duration
- ว่า response ถูกถอดรหัสสำเร็จหรือไม่

### 12.5 ห้าม log ข้อมูลลับ

ไม่ควร log:

- raw AES key
- RSA private key
- decrypted sensitive payload
- ไฟล์ของผู้ใช้ใน plaintext

## 13. Error Handling ที่ Frontend ควรทำ

### 13.1 `400 Bad Request`

มักเกิดจาก:

- body business ไม่ครบ
- form code ไม่ถูกต้อง
- ไม่มีไฟล์ใน session
- ไฟล์ไม่ครบสำหรับ merge

frontend ควร:

- แสดงข้อความตาม `message` หรือ `error`
- ผูกข้อความกับ field หรือขั้นตอนที่ผิด

### 13.2 `401` หรือ `403`

มักเกิดจาก:

- ไม่มี session cookie
- cookie หมดอายุ
- ไม่ส่ง `credentials: 'include'`

frontend ควร:

- re-init session
- ให้ user retry

### 13.3 `404`

มักเกิดจาก:

- ไม่พบ form configuration
- form code/sub type ไม่ตรง backend

frontend ควร:

- ตรวจ mapping ของ `form_code` กับ `sub_type`
- ไม่ hardcode ค่าโดยไม่อิง backend form detail

### 13.4 ถอดรหัส response ไม่ผ่าน

มักเกิดจาก:

- ใช้ AES key ผิด request
- response ถูก parse/transform ระหว่างทาง
- base64 หรือ tag ประกอบไม่ถูก

frontend ควร:

- ทิ้ง response ชุดนั้น
- log metadata สำหรับ debug
- ถ้าจำเป็นค่อย retry แบบสร้าง request ใหม่ทั้งหมด

## 14. Troubleshooting ที่พบบ่อย

### 14.1 ได้ข้อความแนว `This API requires Encryption`

สาเหตุ:

- ส่ง raw JSON ไปยัง secure endpoint

วิธีแก้:

- ใช้ `postEncrypted()` หรือ helper กลางเท่านั้น

### 14.2 ได้ `No uploaded files found.`

สาเหตุ:

- ยังไม่อัปโหลดไฟล์
- session cookie หาย ทำให้ backend มองเป็นคนละ session

วิธีแก้:

- เรียก `POST /session/init` ใหม่
- ตรวจว่า request อัปโหลดกับ request validation ใช้ session เดียวกัน

### 14.3 response ถอดไม่ได้

สาเหตุ:

- เอา AES key คนละ request มาถอด
- สลับลำดับ request ระหว่าง async call

วิธีแก้:

- ให้ request context อยู่ใน scope เดียวกับ request นั้น
- อย่าใช้ global mutable variable เดียวเก็บ AES key ล่าสุด

### 14.4 อัปโหลดแล้ว validation ยังเห็นไฟล์เก่า

ปัจจุบัน backend เลือกไฟล์ล่าสุดต่อ `file_key`

ถ้ายังเห็นอาการนี้ ให้เช็ก:

- ใช้ `file_key` เดิมจริงหรือไม่
- ใช้ `form_code` เดิมจริงหรือไม่
- upload สำเร็จก่อนยิง validation แล้วหรือยัง

## 15. ตัวอย่างไฟล์อ้างอิง

- [api-client.ts](/Users/pst./senior/backend/postman/examples/api-client.ts)
- [README.md](/Users/pst./senior/backend/postman/README.md)
- [Testwebbackend index.php](/Users/pst./senior/Testwebbackend/index.php)

## 16. Checklist สำหรับทีม Frontend

- ดึง public key ก่อนยิง secure endpoint
- init session ก่อน flow หลัก
- ใช้ `credentials: 'include'` ทุก request ที่เกี่ยวกับ session
- เติม `_ts` และ `nonce` ก่อนเข้ารหัส
- สร้าง AES key ใหม่ทุก request
- ถอด response ด้วย AES key ของ request เดิม
- upload ไฟล์แบบ encrypted ได้เมื่อจำเป็น
- สื่อสารกับผู้ใช้ว่าอัปโหลดซ้ำคือ replace ไฟล์เดิม
- ใช้ `degree_level` ใน validation / merge / chat
