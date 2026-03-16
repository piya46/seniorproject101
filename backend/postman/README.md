# Postman Guide

Version: `v1.6.1`
Last updated: `2026-03-16`

Change summary:
- เปลี่ยน `POST /validation/check-completeness` ให้ใช้ `degree_level`
- ปรับพฤติกรรมการเลือกไฟล์ให้ใช้ไฟล์ล่าสุดต่อ `file_key`
- ขยาย examples, onboarding และเอกสารสำหรับแชร์ทีมภายใน

โฟลเดอร์นี้ประกอบด้วยไฟล์สำหรับใช้งาน Sci-Request System บน Postman:

- `Sci-Request-System.postman_collection.json`
- `Sci-Request-System.local.postman_environment.json`
- `Sci-Request-System.staging.postman_environment.json`
- `Sci-Request-System.production.postman_environment.json`
- `TEAM_ONBOARDING_POSTMAN.md`
- `POSTMAN_WORKSPACE_PUBLISHING_GUIDE.md`
- `CHANGELOG_POSTMAN_DOCS.md`
- `GITHUB_SECRETS_SETUP.md`
- `RELEASE_CHECKLIST_POSTMAN_DOCS.md`
- `FRONTEND_INTEGRATION_GUIDE.md`
- `examples/api-client.ts`

ถ้าต้องการคู่มือสั้นมากสำหรับสมาชิกใหม่ ให้เริ่มที่ `TEAM_ONBOARDING_POSTMAN.md` ก่อน แล้วค่อยย้อนมาอ่านไฟล์นี้
ถ้าต้องการคู่มือเชิง implementation ฝั่ง frontend โดยตรง ให้ต่อที่ `FRONTEND_INTEGRATION_GUIDE.md` และดู sample code ใน `examples/api-client.ts`

## 1. ไฟล์แต่ละตัวใช้ทำอะไร

### 1.1 Collection

- `Sci-Request-System.postman_collection.json`
  ใช้ import request ทั้งหมด, collection-level encryption scripts, examples, และเอกสาร API

### 1.2 Environments

- `Sci-Request-System.local.postman_environment.json`
  สำหรับใช้งานกับ server local

- `Sci-Request-System.staging.postman_environment.json`
  สำหรับใช้งานกับ server staging

- `Sci-Request-System.production.postman_environment.json`
  สำหรับใช้งานกับ production

## 1.3 Postman Publish Flow

ชุดนี้ผูกกับ GitHub Actions แล้ว และ release/publish ใช้ผ่าน GitHub Actions เท่านั้น

GitHub Actions จะทำงานดังนี้:

- validate ทุกครั้งที่มีการแก้ไฟล์ใน `backend/postman`
- publish อัตโนมัติเมื่อสร้าง tag รูปแบบ `docs/vX.Y.Z`
- publish เฉพาะตอน version ของ docs เปลี่ยนจริง
- ถ้า tag version ไม่ตรงกับ version ใน collection workflow จะไม่ publish
- workflow จะเขียน summary ลงหน้า Actions ว่ารอบนั้น version เปลี่ยนจากอะไรเป็นอะไร

สคริปต์ในโปรเจกต์ที่ใช้ได้:

- `npm run docs:postman:bump -- vX.Y.Z`
- `npm run docs:postman:validate`
- `npm run docs:postman:version`

ความหมายของแต่ละคำสั่ง:

- `docs:postman:bump` อัปเดต version ใน collection, README และ changelog พร้อมกัน
- `docs:postman:validate` ตรวจ JSON, script syntax และ version consistency

GitHub Secrets ที่ต้องมีตอน publish:

- `POSTMAN_API_KEY` สำหรับเรียก Postman API
- `POSTMAN_COLLECTION_UID` ถ้าต้องการอัปเดต collection เดิม
- `POSTMAN_WORKSPACE_ID` ถ้าต้องการให้สร้าง collection ใหม่เมื่อยังไม่มี UID

หมายเหตุ:

- ถ้าตั้งทั้ง `POSTMAN_COLLECTION_UID` และ `POSTMAN_WORKSPACE_ID` ระบบจะเลือก update collection เดิมก่อน
- ถ้าไม่มี `POSTMAN_COLLECTION_UID` แต่มี `POSTMAN_WORKSPACE_ID` ระบบจะสร้าง collection ใหม่ใน workspace ที่ระบุ
- ถ้าต้องการตั้ง GitHub Secrets แบบทีละขั้น ให้ดู `GITHUB_SECRETS_SETUP.md`
- ถ้าต้องการ checklist ก่อนออก tag ให้ดู `RELEASE_CHECKLIST_POSTMAN_DOCS.md`
- ถ้าต้องการคู่มือเฉพาะ frontend ให้ดู `FRONTEND_INTEGRATION_GUIDE.md`

ตัวอย่าง release แบบเข้ม:

```bash
npm run docs:postman:bump -- v1.6.0
git add backend/postman backend/package.json backend/scripts
git commit -m "docs: bump Postman API docs to v1.6.0"
git tag docs/v1.6.0
git push origin docs/v1.6.0
```

## 2. วิธี Import แบบครบชุด

1. เปิด Postman
2. กด `Import`
3. เลือกไฟล์ `Sci-Request-System.postman_collection.json`
4. กด `Import` อีกครั้ง
5. เลือกไฟล์ environment ทั้ง 3 ไฟล์ หรือเลือกทีละไฟล์ก็ได้
6. ตรวจว่ามี environment ขึ้นครบ:
   - `Sci-Request System Local`
   - `Sci-Request System Staging`
   - `Sci-Request System Production`

## 3. ค่าเริ่มต้นของแต่ละ Environment

### 3.1 Local

- `baseUrl = http://localhost:8080/api/v1`

เหมาะสำหรับ:

- พัฒนาในเครื่อง
- ทดสอบ endpoint ก่อน deploy

### 3.2 Staging

- `baseUrl = https://staging.example.com/api/v1`

หมายเหตุ:

- ค่านี้ยังเป็น placeholder
- ต้องเปลี่ยนเป็น staging URL จริงของทีมก่อนใช้งาน

เหมาะสำหรับ:

- ทดสอบก่อนขึ้น production
- ให้ QA หรือทีมอื่นลอง flow จริง

### 3.3 Production

- `baseUrl = https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1`

เหมาะสำหรับ:

- ตรวจสอบ behavior บนระบบจริง
- อ่าน docs และดู examples เทียบกับของจริง

## 4. วิธีสลับ Environment ใน Postman

1. มุมขวาบนของ Postman เลือก environment
2. เลือก `Local`, `Staging`, หรือ `Production`
3. เปิด environment variables ตรวจ `baseUrl`
4. ถ้าใช้ staging ให้แก้ URL placeholder ก่อน

## 5. สิ่งที่ Collection นี้ทำให้อัตโนมัติ

Collection นี้มี collection-level scripts ที่ทำงานอัตโนมัติ:

- เข้ารหัส JSON `POST`, `PUT`, `PATCH`
- เติม `_ts` และ `nonce`
- ขอ public key ให้อัตโนมัติถ้ายังไม่มี
- ถอดรหัส encrypted response
- แสดง decrypted response ใน `Visualize`

ดังนั้นสำหรับ secure JSON endpoint:

- ให้กรอก body แบบ plaintext
- ไม่ต้องกรอก `encKey`, `iv`, `tag`, `payload` เอง

## 5.1 มุมมองที่ Frontend ต้องเข้าใจ

สำหรับระบบจริง ฝั่ง Frontend ไม่ได้ส่ง business JSON ตรงไปที่ backend แต่ต้องห่อด้วย encryption wrapper ทุกครั้งที่เรียก secure JSON endpoint

ลำดับที่ frontend ควรคิดมีดังนี้:

1. ดึง public key จาก `GET /auth/public-key`
2. เริ่ม session ด้วย `POST /session/init`
3. สร้าง plaintext business body
4. เติม `_ts` และ `nonce`
5. สร้าง AES key ใหม่เฉพาะ request นั้น
6. เข้ารหัส body ด้วย `AES-256-GCM`
7. เข้ารหัส AES key ด้วย `RSA-OAEP SHA-256`
8. ส่ง wrapper object ไปยัง backend
9. ถ้า response ถูกเข้ารหัส ให้ถอดรหัสด้วย AES key ของ request เดิมก่อนส่งต่อให้ UI

ใน Postman collection นี้ script จะทำข้อ 3-9 ให้อัตโนมัติ แต่ใน frontend จริงต้องมี API client ที่ทำขั้นตอนเหล่านี้เอง

## 5.2 สิ่งที่ Frontend ต้องส่งเอง กับสิ่งที่ encryption layer จัดการให้

สิ่งที่ Frontend ต้องส่งเอง:

- `form_code`
- `degree_level`
- `sub_type`
- `message`
- field ทางธุรกิจอื่นตาม endpoint

สิ่งที่ encryption layer ต้องจัดการ:

- `_ts`
- `nonce`
- AES key
- IV
- GCM tag
- RSA encryption ของ AES key
- การถอดรหัส response

## 5.3 รูปแบบข้อมูลก่อนและหลังเข้ารหัส

ตัวอย่าง business body ก่อนเข้ารหัส:

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null
}
```

plaintext body ที่ควรนำไปเข้ารหัสจริง:

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null,
  "_ts": 1710000000000,
  "nonce": "req-1710000000000-x8f4ab"
}
```

wrapper payload ที่ถูกส่งผ่าน network:

```json
{
  "encKey": "base64-rsa-encrypted-aes-key",
  "iv": "base64-12-byte-iv",
  "tag": "base64-gcm-auth-tag",
  "payload": "base64-aes-gcm-ciphertext"
}
```

ความหมายของแต่ละ field:

- `encKey` คือ AES key ที่ถูกเข้ารหัสด้วย public key ของ backend
- `iv` คือ initialization vector สำหรับ AES-GCM
- `tag` คือ authentication tag สำหรับตรวจความถูกต้องของข้อมูล
- `payload` คือ JSON business body ที่ถูกเข้ารหัสแล้ว

## 6. Endpoint แบบไหนถูกเข้ารหัส

### 6.1 ถูกเข้ารหัสอัตโนมัติ

- JSON `POST`
- JSON `PUT`
- JSON `PATCH`

### 6.2 ไม่ถูกเข้ารหัส

- `GET`
- `multipart/form-data`

ดังนั้น `POST /upload` จะไม่ถูกครอบด้วย encrypted JSON transport

หมายเหตุเรื่องไฟล์ล่าสุด:

- ถ้าอัปโหลดไฟล์ใหม่ด้วย `file_key` และ `form_code` เดิม ระบบจะถือว่าเป็นการแทนที่ไฟล์เดิม
- backend จะลบ record/file เก่าของคู่นั้น แล้วเก็บไว้เฉพาะไฟล์ล่าสุด
- `Validation` และ `Merge` จะเลือกใช้ไฟล์ล่าสุดต่อ `file_key` เท่านั้น

## 7. วิธีเริ่มใช้งานในแต่ละ Environment

ไม่ว่าจะเป็น Local, Staging หรือ Production ให้ใช้ลำดับเดียวกัน:

1. เลือก environment
2. เรียก `Get Public Key`
3. เรียก `Initialize Session`
4. เริ่มเรียก endpoint ที่ต้อง auth

หลังจาก `Initialize Session` สำเร็จ:

- Postman จะเก็บ cookie `sci_session_token`
- request ถัดไปใน domain เดียวกันจะใช้ session เดิมได้

## 8. ตัวอย่างการใช้งานจริงตาม Environment

### 8.1 ใช้กับ Local

แนะนำลำดับ:

1. เลือก `Sci-Request System Local`
2. ตรวจว่า backend local ทำงานที่ `localhost:8080`
3. ยิง `Get Public Key`
4. ยิง `Initialize Session`
5. ยิง `List Forms`
6. ยิง `Examples > JT44 > Check Completeness - JT44 Graduate`

### 8.2 ใช้กับ Staging

แนะนำลำดับ:

1. เลือก `Sci-Request System Staging`
2. แก้ `baseUrl` เป็น staging URL จริง
3. ยิง `Get Public Key`
4. ยิง `Initialize Session`
5. ทดสอบ flow รายฟอร์มจากโฟลเดอร์ `Examples`

### 8.3 ใช้กับ Production

แนะนำลำดับ:

1. เลือก `Sci-Request System Production`
2. ยิง `Get Public Key`
3. ยิง `Initialize Session`
4. ทดสอบเฉพาะกรณีที่ปลอดภัยและไม่มีข้อมูลจริงอ่อนไหว

## 9. วิธีกรอก Body สำหรับ Secure JSON Endpoint

ให้กรอก business body ปกติ เช่น

### Session Init

```json
{}
```

### Validation

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null
}
```

หมายเหตุ:

- `Validation` ใช้ `degree_level`
- ระบบจะตรวจเฉพาะไฟล์ล่าสุดของแต่ละ `file_key` ในฟอร์มนั้น รวมถึงไฟล์ `general` ที่เกี่ยวข้อง

### Merge

```json
{
  "form_code": "JT44",
  "degree_level": "bachelor",
  "sub_type": null
}
```

### Chat

```json
{
  "message": "ต้องการลาพักการเรียนเพราะป่วย",
  "degree_level": "bachelor"
}
```

script จะเติม:

- `_ts`
- `nonce`

และเข้ารหัสให้อัตโนมัติ

## 9.1 ถ้า implement ฝั่ง Frontend จริงควรแยก helper อะไรบ้าง

แนะนำให้แยก API client กลาง เช่น:

- `fetchPublicKey()`
- `encryptJsonPayload(plaintextBody, publicKey)`
- `postEncrypted(url, businessBody)`
- `decryptJsonResponse(response, aesKey)`

แนวคิดคือ component/UI ไม่ควรแตะ `encKey`, `iv`, `tag`, `payload` โดยตรง แต่ให้เรียกผ่าน helper กลางเพื่อลด bug เรื่อง nonce ซ้ำ, key mismatch และการลืมแนบ cookie

## 10. วิธีดู Response ที่ถอดรหัสแล้ว

สำหรับ secure endpoint:

1. กดส่ง request
2. เปิดแท็บ `Visualize`
3. ดู `Decrypted Response`

นอกจากนี้ยังมีตัวแปร runtime:

- `lastDecryptedResponse`

ใช้ดู JSON ที่ถอดรหัสแล้วได้เช่นกัน

## 10.1 วิธีคิดเรื่องการถอดรหัส Response

ถ้า backend ตอบกลับแบบ encrypted response ฝั่ง frontend ควรทำตามนี้:

1. ตรวจว่า response มี `iv`, `tag`, `payload` หรือไม่
2. ใช้ AES key ของ request เดิม
3. ถอดรหัส `payload`
4. ตรวจว่า GCM tag ผ่านก่อนค่อย parse JSON
5. ส่ง object ที่ถอดรหัสแล้วให้ UI ใช้งาน

ถ้าถอดรหัสไม่ผ่าน:

- ห้ามใช้ข้อมูล response ต่อ
- ให้ถือว่า integrity ของ response ไม่ผ่าน
- ควร log เพื่อ debug แต่ไม่ควร log key จริงใน production

## 11. วิธีใช้โฟลเดอร์ Examples

โฟลเดอร์ `Examples` ถูกจัดเพื่อให้ทีมเปิดดูตาม form code ได้ทันที:

- `JT31`
- `JT32`
- `JT34`
- `JT35`
- `JT41`
- `JT43`
- `JT44`

ในแต่ละโฟลเดอร์จะมี request preset เช่น:

- `Get Form Detail`
- `Check Completeness`
- `Merge Documents`

และตอนนี้มี response examples หลายกรณีอยู่ใต้ request โดยตรง เช่น:

- `200`
- `400`
- `404`

## 12. ปัญหาที่พบบ่อย

### 12.1 ได้ `Access Denied: This API requires Encryption`

ให้เช็ก:

- request เป็น raw JSON หรือไม่
- header เป็น `Content-Type: application/json` หรือไม่
- request นั้นเป็น `POST`/`PUT`/`PATCH` หรือไม่
- frontend ยิงผ่าน helper ที่เข้ารหัสจริงหรือไม่
- body ถูกแก้ระหว่าง interceptor หรือ middleware หรือไม่

### 12.2 ได้ `Replay detected (Duplicate Nonce)`

ให้เช็ก:

- มีการนำ encrypted body เดิมกลับมาใช้หรือไม่
- มีการ copy body ที่ถูก script แปลงแล้วไปยิงซ้ำหรือไม่

### 12.3 ได้ `Request expired. Please sync your clock.`

ให้เช็ก:

- เวลาเครื่องคลาดเคลื่อนหรือไม่

### 12.4 Response ยังเป็น `iv`, `tag`, `payload`

ให้เช็ก:

- request นั้นถูกเข้ารหัสจาก collection script จริงหรือไม่
- script มี error หรือไม่
- body ถูกแก้เป็น encrypted payload เองหรือไม่
- ฝั่ง frontend ถอดรหัส response ก่อนส่งให้ UI แล้วหรือยัง
- มีการใช้ AES key คนละตัวกับ request นั้นหรือไม่

### 12.5 ถอดรหัสไม่ผ่านหรือ GCM tag fail

ให้เช็ก:

- ใช้ AES key เดียวกับ request ที่ส่งจริงหรือไม่
- `iv`, `tag`, `payload` ถูกแก้ระหว่างทางหรือไม่
- มีการ retry request แล้ว map response กลับผิด request หรือไม่
- มีการ reuse encrypted payload เดิมหรือไม่

## 13. แนวทางใช้งานสำหรับทีม

### ฝั่ง Developer

- ใช้ `Local` เป็นหลัก
- ใช้ `Examples` ดู request/response รายฟอร์ม

### ฝั่ง QA

- ใช้ `Staging`
- ไล่ flow ตาม `Examples`

### ฝั่ง Product หรือทีมที่อ่านเอกสาร

- เปิด collection description
- เปิด request description
- ดู saved examples และ response examples

## 14. หมายเหตุสำคัญ

- ห้ามใส่ secret จริงลง environment ที่แชร์ทีม
- ควรแยก environment ตามระบบจริงเสมอ
- ควรอัปเดต examples ทุกครั้งที่ backend เปลี่ยน contract

## 15. เอกสารและตัวอย่างสำหรับ Frontend

- `FRONTEND_INTEGRATION_GUIDE.md` สำหรับอธิบาย flow encryption/decryption แบบละเอียด
- `examples/api-client.ts` สำหรับตัวอย่าง API client ที่ตรงกับ encryption model ของระบบ
