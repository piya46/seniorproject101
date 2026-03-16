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

ถ้าต้องการคู่มือสั้นมากสำหรับสมาชิกใหม่ ให้เริ่มที่ `TEAM_ONBOARDING_POSTMAN.md` ก่อน แล้วค่อยย้อนมาอ่านไฟล์นี้

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

## 10. วิธีดู Response ที่ถอดรหัสแล้ว

สำหรับ secure endpoint:

1. กดส่ง request
2. เปิดแท็บ `Visualize`
3. ดู `Decrypted Response`

นอกจากนี้ยังมีตัวแปร runtime:

- `lastDecryptedResponse`

ใช้ดู JSON ที่ถอดรหัสแล้วได้เช่นกัน

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
