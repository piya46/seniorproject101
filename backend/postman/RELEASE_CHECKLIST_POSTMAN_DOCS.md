# Release Checklist: Postman API DOC

ใช้ checklist นี้ก่อนออก tag `docs/vX.Y.Z`

## ก่อนออก tag

1. รัน `cd backend && npm run docs:postman:bump -- vX.Y.Z`
2. ตรวจว่า version ใน collection, README และ changelog ตรงกัน
3. รัน `cd backend && npm run docs:postman:validate`
4. ตรวจว่า request/response examples ล่าสุดตรงกับ backend
5. ตรวจว่า environment files (`local`, `staging`, `production`) ชี้ `baseUrl`/callback/origin ถูกต้องและไม่มีตัวแปรซ้ำ
6. ตรวจว่า `CHANGELOG_POSTMAN_DOCS.md` มี section ของ version ที่จะปล่อยและแก้ข้อความ placeholder แล้ว
7. ตรวจว่า GitHub Secrets สำหรับ Postman ถูกตั้งครบแล้ว

## ตอนออก tag

1. commit ไฟล์ docs ให้เรียบร้อย
2. สร้าง tag เช่น `docs/v1.9.8`
3. push tag ขึ้น remote

```bash
npm run docs:postman:bump -- v1.9.9
git add .
git commit -m "docs: release Postman API docs v1.9.9"
git tag docs/v1.9.9
git push origin docs/v1.9.9
```

## หลังออก tag

1. เปิด GitHub Actions
2. ดู workflow `Postman API Docs`
3. ตรวจว่า `validate`, `version-change`, `publish` ผ่าน
4. ตรวจว่า GitHub Release ถูกสร้าง
5. ตรวจว่า assets ถูกแนบใน GitHub Release
6. ตรวจว่า collection บน Postman ถูกอัปเดตเป็น version ล่าสุด
