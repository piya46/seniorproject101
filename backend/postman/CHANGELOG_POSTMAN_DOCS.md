# Changelog Postman Docs

Current version: `v1.6.1`
Last updated: `2026-03-16`

## v1.6.1

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- อัปเดตสรุปการเปลี่ยนแปลงที่นี่

Breaking change:

- ระบุถ้ามี breaking change

ผลกระทบฝั่งทีม:

- ระบุสิ่งที่ทีมต้องทำต่อ

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
