# TEAM ONBOARDING: Postman สำหรับ Sci-Request

ไฟล์นี้ใช้สำหรับเริ่มงานให้เร็วที่สุดภายใน 5-10 นาที

## 1. Import ไฟล์

ให้ import ไฟล์ต่อไปนี้เข้า Postman:

- `Sci-Request-System.postman_collection.json`
- `Sci-Request-System.local.postman_environment.json`
- `Sci-Request-System.staging.postman_environment.json`
- `Sci-Request-System.production.postman_environment.json`

## 2. เลือก Environment

เลือก environment ที่มุมขวาบนของ Postman

- `Sci-Request System Local`
- `Sci-Request System Staging`
- `Sci-Request System Production`

หมายเหตุ:

- `Staging` ยังต้องตรวจ `baseUrl` ให้เป็น URL จริงของทีมก่อนใช้งาน
- `Production` ใน repo ตอนนี้ชี้ไป `https://ai-formcheck-backend-499335698145.asia-southeast3.run.app/api/v1` แล้ว
- ถ้าพัฒนาในเครื่อง ให้เริ่มจาก `Local`
- environment แต่ละไฟล์มีตัวแปรช่วยเรื่อง origin/callback เช่น `frontendBaseOrigin`, `frontendAuthCallbackUrl`, และ `legacyOidcCallbackUrl` ให้ใช้เป็นจุดอ้างอิงเวลาเทส OIDC

## 3. ลำดับที่ต้องยิงครั้งแรก

ทุก environment ให้เริ่มตามนี้:

1. `Auth > Get Public Key`
2. `Session > Initialize Session`
3. endpoint อื่นที่ต้องการทดสอบ

หลัง `Initialize Session` สำเร็จ Postman จะใช้ session cookie ต่อให้อัตโนมัติ

## 4. เรื่อง Encryption

collection นี้มี script กลางที่ทำให้อัตโนมัติแล้ว

- endpoint JSON แบบ `POST` / `PUT` / `PATCH` จะถูกเข้ารหัสให้อัตโนมัติ
- script จะเติม `_ts` และ `nonce` ให้เอง
- response ที่เข้ารหัสจะถูกถอดรหัสให้อัตโนมัติ

สิ่งที่ทีมต้องทำ:

- กรอก body เป็น JSON ปกติแบบ plaintext
- ไม่ต้องสร้าง `encKey`, `iv`, `tag`, `payload` เอง

ถ้าต้องการรายละเอียดเชิง implementation ฝั่ง frontend ให้อ่านเพิ่มใน `README.md` ส่วน encryption/decryption

## 5. ดูตัวอย่างให้เร็วที่สุด

ถ้าต้องการดู flow รายฟอร์ม ให้เปิดโฟลเดอร์ `Examples`

- `JT31`
- `JT32`
- `JT34`
- `JT35`
- `JT41`
- `JT43`
- `JT44`

ใน `JT41` มีแยกย่อยครบทุก subtype เช่น `late_reg`, `change_section`, `cross_faculty`, `credit_limit` และกรณีอื่นที่ระบบรองรับ

## 6. จุดที่ควรเริ่มสำหรับสมาชิกใหม่

แนะนำลำดับนี้:

1. อ่าน `README.md`
2. ยิง `Get Public Key`
3. ยิง `Initialize Session`
4. เปิด `Examples > JT41`
5. ลอง `Check Completeness` และ `Merge Documents`

## 7. ถ้าเห็นผลลัพธ์แปลก

ให้เช็กตามนี้ก่อน:

- เลือก environment ถูกหรือไม่
- `baseUrl` ถูกหรือไม่
- ยิง `Initialize Session` แล้วหรือยัง
- request เป็น `multipart/form-data` หรือ secure JSON
- เปิดแท็บ example response หรือ `Visualize` แล้วหรือยัง

## 8. ไฟล์ที่ควรอ่านต่อ

- `README.md` สำหรับคู่มือเต็ม
- `FRONTEND_INTEGRATION_GUIDE.md` สำหรับทีม frontend โดยเฉพาะ
- `POSTMAN_WORKSPACE_PUBLISHING_GUIDE.md` สำหรับคนที่ต้อง publish docs ให้ทีม
- `CHANGELOG_POSTMAN_DOCS.md` สำหรับดูว่าชุด docs นี้เพิ่มอะไรไว้บ้าง
