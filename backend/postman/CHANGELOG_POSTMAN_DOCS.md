# Changelog Postman Docs

Current version: `v1.8.1`
Last updated: `2026-03-17`

## v1.8.1

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- ปรับเอกสาร Postman และ API summary ให้ตรงกับ implementation ล่าสุดของ `upload` และ `support`
- อัปเดตคำอธิบายว่า browser upload request ที่มี `Origin` หรือ `Referer` จะถูกตรวจ frontend allowlist
- เปลี่ยนตัวอย่าง `target_email` ของ support endpoint ให้เป็นค่า placeholder กลาง และอธิบายชัดว่า server resolve จาก `TECH_SUPPORT_TARGET_EMAIL`
- แก้ success contract ของ `POST /upload` ให้ตรง response จริงเป็น `{ status, data: { file_key, form_code } }`

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการแก้ docs ให้ตรง behavior จริงและชัดขึ้นสำหรับ QA/frontend

ผลกระทบฝั่งทีม:

- ถ้าอ้างอิง release/tag เพื่อ publish Postman docs ให้ใช้ `v1.8.1` แทน `v1.8.0`
- QA และ frontend ควรอ้าง success shape ของ `upload` จาก docs ชุดใหม่นี้

## v1.8.0

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่มเอกสารของ `POST /support/technical-email` สำหรับส่งอีเมลแจ้งปัญหาไปยังทีมพัฒนาระบบพร้อมไฟล์แนบ optional
- อัปเดตคำอธิบาย security ว่า support endpoint ใช้ `multipart/form-data` และ harden ด้วย session auth, origin check, fixed server-side target email, file signature check
- อัปเดต `test.html` ให้มีฟอร์มทดสอบ Technical Support email
- อัปเดต collection และ frontend guide ให้สะท้อนข้อจำกัดไฟล์แนบ 1 ไฟล์ ไม่เกิน 2MB และการส่งหาอีเมลปลายทางคงที่ของทีมพัฒนา

Breaking change:

- support endpoint จะไม่รับปลายทางอีเมลจากผู้ใช้แล้ว และจะส่งหา `TECH_SUPPORT_TARGET_EMAIL` ของระบบเท่านั้น

ผลกระทบฝั่งทีม:

- ฝั่งที่เรียก support endpoint ควรจำกัดประเภทไฟล์แนบและขนาดไฟล์ตั้งแต่หน้า UI
- ทีมที่ใช้ Postman ควร re-import collection เวอร์ชันล่าสุดเพื่อเห็น endpoint ใหม่

## v1.7.0

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- อัปเดตเอกสารให้สอดคล้องกับ public form config ที่ส่ง `approval_requirements` และ `case_rules` ออกมาชัดเจนจาก `GET /forms/:form_code`
- อัปเดตเอกสาร validation ให้รองรับ `case_key` แบบ optional ใน `POST /validation/check-completeness`
- ขยายคู่มือ frontend ให้ครอบคลุมการใช้ `approval_requirements`, `case_rules`, `case_key` และ flow ตรวจเอกสารตามกรณีย่อย
- ปรับ sample client `api-client.ts` ให้รองรับ `FormDetail`, `FormCaseRule` และส่ง `case_key` ได้
- bump version ของชุด Postman docs เป็น `v1.7.0`

Breaking change:

- ไม่มี breaking change ระดับ path หรือ transport format แต่ frontend ที่ต้องการตรวจเอกสารตามกรณีย่อยควรเริ่มส่ง `case_key`

ผลกระทบฝั่งทีม:

- Frontend ควรอ่าน `approval_requirements` และ `case_rules` จาก form detail แทนการ hardcode
- ฝั่งที่เรียก `validation/check-completeness` สามารถส่ง `case_key` เมื่อฟอร์มมี `case_rules`
- ทีมที่ใช้ Postman / frontend guide ควร re-import collection และอ้างอิงคู่มือเวอร์ชันล่าสุด

## v1.6.1

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- แยกคู่มือ frontend ออกเป็นไฟล์ `FRONTEND_INTEGRATION_GUIDE.md`
- เพิ่มตัวอย่าง browser client ที่ใช้ Web Crypto ใน `examples/api-client.ts`
- ขยายคำอธิบายเรื่อง encryption/decryption, sequence flow และการใช้งานฝั่ง frontend

Breaking change:

- ไม่มี breaking change ระดับ contract หลัก เป็นการขยายเอกสารและ sample code

ผลกระทบฝั่งทีม:

- ทีม frontend สามารถอ้างอิง guide และ sample client แทนการดู description ใน collection อย่างเดียว
- ทีมที่ใช้เอกสารเวอร์ชันเก่าควรอัปเดตลิงก์อ้างอิงมายังคู่มือ frontend ใหม่

## v1.6.0

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เปลี่ยน request contract ของ `POST /validation/check-completeness` จาก `student_level` เป็น `degree_level`
- ปรับเอกสารให้สอดคล้องกับ backend ที่ใช้ไฟล์ล่าสุดต่อ `file_key`
- เพิ่มคำอธิบายใน `Upload`, `Validation`, `Merge` ว่าการอัปโหลดซ้ำจะถือเป็นการแทนที่ไฟล์เดิม
- ขยาย examples รายฟอร์มสำคัญและ subtype ของ `JT41`
- ปรับ collection descriptions ให้ render ใน Postman ได้ดีขึ้น
- เพิ่ม onboarding docs และคู่มือสำหรับแชร์ทีมภายใน

Breaking change:

- client เดิมที่ยังส่ง `student_level` ใน endpoint `validation/check-completeness` ต้องปรับเป็น `degree_level`

ผลกระทบฝั่งทีม:

- Frontend ต้องส่ง `degree_level` ให้ตรงกับค่า `bachelor` หรือ `graduate`
- QA และทีมที่ใช้ Postman ต้อง re-import collection เวอร์ชันล่าสุด
- ถ้ามี request examples เก่าที่ copy เก็บไว้ภายนอก collection ให้เปลี่ยนตาม contract ใหม่

## สิ่งที่มีอยู่ในชุด docs ปัจจุบัน

- Collection หลักพร้อม encryption/decryption scripts
- Environment แยก `Local`, `Staging`, `Production`
- Examples แยกตาม form code และกรณีใช้งาน
- Response examples หลายสถานะ
- README สำหรับการใช้งาน
- คู่มือ publish docs บน Postman workspace
- onboarding guide แบบสั้นสำหรับสมาชิกใหม่

## ไฟล์สำคัญ

- [Sci-Request-System.postman_collection.json](/Users/pst./senior/backend/postman/Sci-Request-System.postman_collection.json)
- [Sci-Request-System.local.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.local.postman_environment.json)
- [Sci-Request-System.staging.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.staging.postman_environment.json)
- [Sci-Request-System.production.postman_environment.json](/Users/pst./senior/backend/postman/Sci-Request-System.production.postman_environment.json)
- [README.md](/Users/pst./senior/backend/postman/README.md)
- [TEAM_ONBOARDING_POSTMAN.md](/Users/pst./senior/backend/postman/TEAM_ONBOARDING_POSTMAN.md)
- [POSTMAN_WORKSPACE_PUBLISHING_GUIDE.md](/Users/pst./senior/backend/postman/POSTMAN_WORKSPACE_PUBLISHING_GUIDE.md)
