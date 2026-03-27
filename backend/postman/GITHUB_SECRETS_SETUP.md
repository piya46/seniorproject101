# GitHub Secrets Setup สำหรับ Postman API DOC

ไฟล์นี้ใช้สำหรับตั้งค่าให้ GitHub Actions publish Postman collection อัตโนมัติ

## ต้องมีอะไรบ้าง

ต้องตั้ง GitHub repository secrets เหล่านี้:

- `POSTMAN_API_KEY`
- `POSTMAN_COLLECTION_UID` หรือ `POSTMAN_WORKSPACE_ID`

## ตั้งค่าทีละขั้น

1. เปิด repository บน GitHub
2. ไปที่ `Settings`
3. ไปที่ `Secrets and variables`
4. เลือก `Actions`
5. กด `New repository secret`

## Secret 1: POSTMAN_API_KEY

ใช้สำหรับเรียก Postman API

วิธีหา:

1. เปิด Postman
2. ไปที่ `Settings`
3. ไปที่ `Postman API keys`
4. สร้าง key ใหม่
5. คัดลอกค่า key
6. กลับมาที่ GitHub แล้วสร้าง secret ชื่อ `POSTMAN_API_KEY`

## Secret 2: POSTMAN_COLLECTION_UID

ใช้กรณีต้องการอัปเดต collection เดิม

วิธีหา:

1. เปิด Postman collection ที่ต้องการ
2. เปิด `View more actions` หรือเมนู collection
3. หา collection UID จาก URL หรือ Postman API
4. นำค่าไปตั้งเป็น secret ชื่อ `POSTMAN_COLLECTION_UID`

ถ้าทีมมี collection เดิมอยู่แล้ว แนะนำให้ใช้วิธีนี้

## Secret 3: POSTMAN_WORKSPACE_ID

ใช้กรณีต้องการให้ workflow สร้าง collection ใหม่ใน workspace

วิธีหา:

1. เปิด workspace ใน Postman
2. ดู workspace ID จาก URL หรือ Postman API
3. ตั้งเป็น secret ชื่อ `POSTMAN_WORKSPACE_ID`

ถ้าตั้งทั้ง `POSTMAN_COLLECTION_UID` และ `POSTMAN_WORKSPACE_ID`

- workflow จะเลือก update collection เดิมก่อน

## พฤติกรรมหลังตั้งเสร็จ

- ทุก PR หรือ push ที่แก้ `backend/postman` จะรัน validate
- ถ้าสร้าง tag รูปแบบ `docs/vX.Y.Z` และ version ของ docs เปลี่ยนจริง workflow จะ publish ให้เอง
- ถ้า version ไม่เปลี่ยน workflow จะไม่ publish แม้ไฟล์ docs จะถูกแก้
- ถ้า tag version ไม่ตรงกับ version ใน collection workflow จะไม่ publish
- หน้า Actions จะมี summary บอกว่า release รอบนั้นเปลี่ยนจาก version ไหนไป version ไหน

## เช็กว่าตั้งถูกไหม

1. push การเปลี่ยนแปลง docs ขึ้น repo
2. เปิดแท็บ `Actions` บน GitHub
3. ดู workflow `Postman API Docs`
4. ตรวจว่า job `validate` ผ่าน
5. สร้าง tag เช่น `docs/v1.6.0`
6. push tag ขึ้น origin
7. ถ้า version เปลี่ยนและ secrets ถูกต้อง job `publish` จะทำงานต่อ
8. workflow จะสร้าง GitHub Release notes จาก changelog ให้อัตโนมัติ
