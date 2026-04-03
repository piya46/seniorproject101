# คู่มือการ Publish API Docs บน Postman Workspace

เอกสารนี้อธิบายวิธีนำ Collection ของระบบ Sci-Request ไปใช้เป็นเอกสาร API ภายในทีมบน Postman Workspace ให้ดูเป็นระเบียบ อ่านง่าย และใช้งานต่อได้จริง

## 1. ไฟล์ที่ต้องใช้

- [Sci-Request-System.postman_collection.json](/Users/pst./senior/backend/postman/Sci-Request-System.postman_collection.json)
- [Sci-Request-System.local.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.local.postman_environment.json)
- [Sci-Request-System.staging.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.staging.postman_environment.json)
- [Sci-Request-System.production.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.production.postman_environment.json)

## 2. เป้าหมายของการจัด Postman Workspace

แนะนำให้มอง Postman Workspace เป็น 2 ส่วนพร้อมกัน:

1. พื้นที่สำหรับทดสอบ API
2. พื้นที่สำหรับอ่านเอกสาร API ของทีม

ดังนั้น collection ควรมีทั้ง:

- ชื่อ endpoint ที่สื่อความหมายชัด
- descriptions ภาษาไทย
- request examples
- response examples
- error code table

## 3. วิธี Import เข้า Workspace

1. เปิด Postman
2. เข้า Workspace ที่ทีมใช้งาน
3. กด `Import`
4. เลือกไฟล์ collection
5. เลือกไฟล์ environment
6. ตั้งชื่อ environment ให้สื่อความหมาย เช่น `Local`, `Staging`, `Production`

หมายเหตุ:

- `Production` ใน repo ตอนนี้ชี้ backend จริงที่ `https://ai-formcheck-backend-499335698145.asia-southeast3.run.app/api/v1`
- `Staging` ยังเป็น placeholder และต้องแก้ URL ก่อนใช้งานเสมอ

## 4. แนวทางตั้งชื่อ Collection และ Folder

ชื่อ collection แนะนำ:

- `เอกสาร API ระบบคำร้อง Sci-Request`

การจัด folder แนะนำให้คงตามหมวดธุรกิจแบบนี้:

- `Auth`
- `Session`
- `Departments`
- `Forms`
- `Upload`
- `Validation`
- `Documents`
- `Chat`

ข้อดีคือ:

- คนใหม่ในทีมเปิดมาก็หาทางเดินระบบได้ทันที
- แยกตาม business flow ชัดเจน
- publish docs ออกมาแล้วอ่านง่าย

## 5. วิธีจัดลำดับ Folder ให้สวย

แนะนำเรียงตามลำดับการใช้งานจริง:

1. `Auth`
2. `Session`
3. `Departments`
4. `Forms`
5. `Upload`
6. `Validation`
7. `Documents`
8. `Chat`

ถ้าจะทำให้ทีมอ่าน docs ได้ต่อเนื่อง ลำดับนี้ช่วยได้มาก เพราะสะท้อน flow การใช้งานจริงของ frontend

## 6. วิธีเขียน Description ให้ดูเป็นเอกสาร

ในระดับ Collection ควรมี:

- ภาพรวมระบบ
- วิธีเริ่มต้นใช้งาน
- โมเดล session
- โมเดล encryption
- ข้อควรระวังเรื่อง `_ts` และ `nonce`

ในระดับ Request ควรมี:

- สรุปว่า endpoint นี้ทำอะไร
- request format
- request examples หลายกรณี
- response examples หลายกรณี
- error code table

รูปแบบหัวข้อที่แนะนำ:

- `## สรุป`
- `## Query Parameters`
- `## Request Example`
- `## Response Example`
- `## ตาราง Error Code`
- `## การใช้งานฝั่ง Frontend`

## 7. วิธีใช้ Saved Examples ให้เกิดประโยชน์

Saved examples ใน Postman ควรทำหน้าที่ 2 อย่าง:

1. เป็นตัวอย่างอ้างอิงใน docs
2. เป็นตัวอย่างทดสอบให้ทีมใช้ดูรูปแบบจริง

แนะนำให้ตั้งชื่อ examples ชัดๆ เช่น:

- `ตัวอย่าง Request JT31 bachelor / Response 200`
- `ตัวอย่าง Request JT32 graduate / Response 200`
- `ตัวอย่าง Request JT41 late_reg / Response 400 เอกสารไม่ครบ`

หลักการตั้งชื่อ:

- ระบุ form code
- ระบุระดับการศึกษา ถ้ามีผล
- ระบุ status code หรือผลลัพธ์

## 8. วิธี Publish เอกสารใน Postman

ขึ้นกับ UI เวอร์ชันของ Postman ที่ทีมใช้ แต่แนวทางทั่วไปคือ:

1. เปิด collection ใน workspace
2. ตรวจให้แน่ใจว่า descriptions และ examples ครบ
3. ใช้เมนู share/publish documentation ของ collection หรือ workspace
4. ตั้งค่า visibility ให้เหมาะกับทีมภายใน

ก่อน publish ควรตรวจ:

- ชื่อ collection อ่านง่าย
- descriptions เป็นภาษาไทยครบ
- environment ไม่มี secret จริงติดไป
- examples ไม่มีข้อมูลจริงที่เป็น sensitive

## 9. วิธีจัดหลาย Environment ให้ทีมใช้สะดวก

แนะนำสร้าง environment แยก:

- `Sci-Request Local`
- `Sci-Request Staging`
- `Sci-Request Production`

ตัวแปรที่ควรแยก:

- `baseUrl`
- `backendBaseOrigin`
- `frontendBaseOrigin`
- `frontendAuthCallbackUrl`
- `legacyOidcCallbackUrl`
- `returnToUrl`
- `publicKey` ถ้าจำเป็นต้อง cache

ตัวแปรที่ไม่ควร hardcode ลง docs:

- token จริง
- cookie จริง
- ข้อมูลนิสิตจริง

## 10. แนวทางความสวยและความอ่านง่าย

ถ้าต้องการให้ docs อ่านง่ายขึ้นในทีม:

- ใช้ภาษาไทยให้คงเส้นคงวาทั้ง collection
- อย่าใช้ชื่อ request สั้นเกินไป
- อย่ารวม endpoint คนละเรื่องไว้ใน folder เดียว
- ใช้ examples หลายกรณีเฉพาะ endpoint ที่ทีมใช้บ่อย
- ใช้ error table แบบสั้น อ่านไว

## 11. Checklist ก่อนแชร์ทีม

- import ได้
- ยิง request ได้
- auto encryption ทำงาน
- auto decryption ทำงาน
- environment ทุกไฟล์ชี้ URL/callback ถูก environment
- descriptions เป็นภาษาไทยครบ
- examples เปิดดูได้ทุก endpoint สำคัญ
- ไม่มี secret จริงใน collection/environment
- folder เรียงตาม flow การใช้งาน

## 12. ข้อเสนอแนะสำหรับการดูแลต่อ

ทุกครั้งที่ backend เปลี่ยน:

1. อัปเดต request body
2. อัปเดต response examples
3. อัปเดต error code table
4. อัปเดต examples ที่กระทบ form code หรือ sub_type

ถ้าทำสี่อย่างนี้สม่ำเสมอ Postman Workspace จะเป็นทั้ง test asset และ source of truth ของทีมได้ดีมาก
