# Frontend Integration Guide

Version: `v1.6.1`  
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
- [test.html](/Users/pst./senior/test.html)

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
