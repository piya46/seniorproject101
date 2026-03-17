# API Documentation

Version: `v1.8.3`
Last updated: `2026-03-17`

เอกสารนี้เป็นสรุป API contract ฝั่ง backend แบบย่อสำหรับทีมที่ต้องการดูภาพรวมเร็ว โดยรายละเอียดเชิง integration, encryption flow, Postman examples และ frontend behavior แบบเต็มอยู่ที่:

- [README.md](/Users/pst./senior/backend/postman/README.md)
- [FRONTEND_INTEGRATION_GUIDE.md](/Users/pst./senior/backend/postman/FRONTEND_INTEGRATION_GUIDE.md)
- [Sci-Request-System.postman_collection.json](/Users/pst./senior/backend/postman/Sci-Request-System.postman_collection.json)

## Overview

- Base URL: `/api/v1`
- Authentication: session cookie, and optionally Google Cloud IAP as an outer access gate for `@chula.ac.th` and `@student.chula.ac.th`
- Secure JSON endpoints ใช้ encryption transport
- `GET` และ `multipart/form-data` ไม่ใช้ secure JSON wrapper
- `GET /healthz` เป็น service-level health endpoint ที่อยู่นอก `/api/v1`
- `POST /support/technical-email` เป็น multipart endpoint สำหรับแจ้งปัญหาไปยังทีมพัฒนาระบบ

## Endpoint Matrix

| Endpoint | Method | ต้อง Auth | ต้อง Encryption | Request fields หลัก | Response หลัก |
| --- | --- | --- | --- | --- | --- |
| `/healthz` | `GET` | ไม่ต้อง | ไม่ต้อง | - | `{ status: "ok" }` |
| `/auth/public-key` | `GET` | ไม่ต้อง | ไม่ต้อง | - | `{ publicKey }` |
| `/session/init` | `POST` | ไม่ต้อง | ต้อง | - | `{ message, session_id }` |
| `/departments` | `GET` | ต้อง | ไม่ต้อง | - | `{ data: Department[] }` |
| `/forms` | `GET` | ต้อง | ไม่ต้อง | `degree_level` | `{ data: FormSummary[] }` |
| `/forms/:form_code` | `GET` | ต้อง | ไม่ต้อง | `degree_level`, `sub_type` | `FormDetail` พร้อม `required_documents`, `approval_requirements`, `case_rules` |
| `/upload` | `POST multipart/form-data` | ต้อง | ไม่ใช้ secure JSON wrapper | `file`, `file_key`, `form_code?`, `encKey`, `iv`, `tag` | `{ status, data: { file_key, form_code } }` |
| `/validation/check-completeness` | `POST` | ต้อง | ต้อง | `form_code`, `degree_level`, `sub_type`, `case_key?` | ผลตรวจราย `file_key` |
| `/documents/merge` | `POST` | ต้อง | ต้อง | `form_code`, `degree_level`, `sub_type` | `{ status, download_url, instruction }` |
| `/chat/recommend` | `POST` | ต้อง | ต้อง | `message`, `degree_level` | `{ reply?, text?, recommended_form? }` |
| `/support/technical-email` | `POST multipart/form-data` | ต้อง | ไม่ใช้ secure JSON wrapper | `reporter_email`, `issue_type`, `subject`, `description`, `attachment?` | `{ status, message, data }` |

## Support Endpoint

### `POST /support/technical-email`

ใช้สำหรับส่งอีเมลแจ้งปัญหาไปยังทีมพัฒนาระบบโดยตรง ไม่ใช่ส่วนหนึ่งของ flow การยื่นคำร้อง

ฟิลด์ที่รับ:

- `reporter_email`
- `issue_type`
- `subject`
- `description`
- `attachment` optional

ข้อจำกัด:

- ต้องมี session cookie (`sci_session_token`) ที่ถูกสร้างจาก `POST /session/init`
- ใช้ `multipart/form-data`
- แนบได้สูงสุด 1 ไฟล์
- ขนาดไฟล์ไม่เกิน 2MB
- รองรับเฉพาะ `jpg`, `png`, `webp`, `pdf`
- request ต้องมี `Origin` หรือ `Referer`
- backend จะตรวจ `Origin/Referer` ให้ตรงกับ allowlist
- ปลายทางอีเมลถูกกำหนดจาก server ผ่าน `TECH_SUPPORT_TARGET_EMAIL` ไม่รับจาก client
- backend จะตรวจ file signature จริง ไม่เชื่อแค่ MIME จาก browser

Success response:

```json
{
  "status": "success",
  "message": "Technical support email sent successfully.",
  "data": {
    "reporter_email": "student@chula.ac.th",
    "target_email": "tech-support@example.com",
    "issue_type": "upload problem",
    "subject": "อัปโหลดไฟล์ไม่ได้",
    "attachment": {
      "original_name": "evidence.png",
      "mime_type": "image/png",
      "size": 185432
    },
    "message_id": "<abc123@example.com>"
  }
}
```

## Error Response Contract กลาง

backend ไม่ได้ตอบ error ทุก endpoint ด้วย schema เดียวกัน 100% แต่ client และ QA ควรรองรับรูปแบบหลักดังนี้

รูปแบบทั่วไป:

```json
{
  "error": "ข้อความสรุปสั้น",
  "message": "ข้อความอธิบายเพิ่มเติม"
}
```

บาง endpoint อาจมี field เฉพาะ:

```json
{
  "error": "Incomplete documents",
  "missing_keys": ["main_form", "citizen_id_copy"]
}
```

### Status ที่ควรรองรับ

| Status | ความหมาย | ตัวอย่างกรณี |
| --- | --- | --- |
| `400` | request ไม่ถูกต้องหรือข้อมูลไม่ครบ | ไม่มีฟิลด์, ไฟล์แนบเกิน 2MB |
| `401` | ไม่มี session หรือ auth ไม่ผ่าน | ไม่ส่ง cookie, cookie หมดอายุ |
| `403` | policy/security check ไม่ผ่าน | origin ไม่อยู่ใน allowlist |
| `404` | ไม่พบ resource/config | form code หรือ subtype ไม่ถูกต้อง |
| `429` | ยิงถี่เกิน rate limit | support endpoint หรือ upload ถูกเรียกซ้ำเร็วเกินไป |
| `500` | backend ล้มเหลว | SMTP config ผิด, merge/storage ล้มเหลว |

### Support Endpoint Error Examples

กรณีไฟล์แนบเกินขนาด:

```json
{
  "error": "Validation Error",
  "message": "Attachment size must not exceed 2MB."
}
```

กรณีไม่มี session:

```json
{
  "error": "Unauthorized: No session token found"
}
```

กรณี origin ไม่ผ่าน policy:

```json
{
  "error": "Forbidden",
  "message": "Origin is not allowed for technical support requests."
}
```

กรณี SMTP login ไม่ผ่าน:

```json
{
  "error": "Failed to send technical support email",
  "message": "Invalid login: 535 5.7.8 Error: authentication failed: authentication failure"
}
```

## Upload Endpoint Notes

### `POST /upload`

- ต้องมี session cookie (`sci_session_token`)
- ใช้ `multipart/form-data`
- รองรับไฟล์ `jpg`, `png`, `webp`, `pdf`
- ขนาดไฟล์ไม่เกิน 10MB
- ถ้าเป็น browser request และมี `Origin` หรือ `Referer` backend จะตรวจให้ตรงกับ frontend allowlist
- ถ้าส่ง `encKey`, `iv`, `tag` มาด้วย backend จะถอดรหัสไฟล์ก่อนตรวจ signature และ sanitize
- ถ้าอัปโหลดไฟล์ใหม่ด้วย `file_key` และ `form_code` เดิม ระบบจะเก็บเฉพาะไฟล์ล่าสุดของคู่นั้น

## Field Notes

- `approval_requirements` ใช้บอกว่าคำร้องต้องมีความเห็นหรือการลงนามจากใครบ้าง
- `case_rules` ใช้บอกกรณีย่อยของ form เดิม โดย public response จะส่งเฉพาะ field ที่ frontend ใช้ได้อย่างปลอดภัย
- `case_key` ใช้ใน `POST /validation/check-completeness` เมื่อ form นั้นมี `case_rules`
- `target_email` ของ support endpoint เป็นค่า server-managed ไม่ได้มาจากผู้ใช้ และถูก resolve จาก `TECH_SUPPORT_TARGET_EMAIL`
- `POST /session/init` จะคืน `session_id` และ set cookie `sci_session_token` ให้ client ใช้กับ endpoint ที่ต้อง auth
- การเปิด Google Cloud IAP เป็น outer gate เป็น infra policy เพิ่มเติม ไม่ได้แทน session auth ภายใน API

## References

- [README.md](/Users/pst./senior/backend/postman/README.md)
- [FRONTEND_INTEGRATION_GUIDE.md](/Users/pst./senior/backend/postman/FRONTEND_INTEGRATION_GUIDE.md)
- [Sci-Request-System.postman_collection.json](/Users/pst./senior/backend/postman/Sci-Request-System.postman_collection.json)
