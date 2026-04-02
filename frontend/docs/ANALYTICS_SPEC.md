# Analytics Event Specification

เอกสารนี้กำหนดมาตรฐานการใช้งาน Google Analytics 4 (GA4) ของระบบ `AI Formcheck` โดยมีเป้าหมายเพื่อเก็บข้อมูลพฤติกรรมการใช้งานในระดับที่จำเป็นต่อการปรับปรุง UX และการวิเคราะห์ drop-off ของผู้ใช้ โดยไม่เก็บข้อมูลส่วนบุคคล (PII) หรือข้อมูลอ่อนไหวเกินจำเป็น

เอกสารฉบับนี้อ้างอิงจาก implementation ปัจจุบันใน [analytics.js](/Users/pst./senior/frontend/src/lib/analytics.js) และ event points ในหน้าใช้งานหลักของระบบ

## วัตถุประสงค์

- วิเคราะห์ว่า user ใช้งาน flow ไหนบ่อย
- วิเคราะห์ว่า user หลุดจากขั้นตอนไหน
- ตรวจสอบว่า form ไหนถูกเลือกมาก
- ดูว่า feature แชตถูกเปิดใช้งานและถูกส่งข้อความมากน้อยแค่ไหน
- รักษาความเป็นส่วนตัวของผู้ใช้โดยไม่ส่ง PII เข้า GA

## กฎเหล็กด้านความเป็นส่วนตัว

ทุก event ต้องผ่าน wrapper ใน [analytics.js](/Users/pst./senior/frontend/src/lib/analytics.js) เท่านั้น และห้ามเรียก `gtag()` โดยตรงจาก component อื่น

ห้ามส่งข้อมูลต่อไปนี้เข้า Google Analytics โดยเด็ดขาด:

- ชื่อ, นามสกุล, อีเมล, เบอร์โทรศัพท์
- session id, csrf token, auth token
- ชื่อไฟล์จริง, เนื้อหาเอกสาร, URL ที่มี signed token
- ข้อความแชต, ข้อความค้นหาดิบ, ข้อความ error ดิบจาก backend
- ข้อมูลที่กรอกในฟอร์ม

อนุญาตให้ส่งได้เฉพาะ metadata ที่ปลอดภัย เช่น:

- `form_code`
- `degree_level`
- `sub_type`
- `step`
- `required_document_count`
- `has_sub_types`
- `has_download_url`
- `has_directory_fallback`
- `failure_stage`
- `message_length_bucket`

## Consent Model

ระบบจะโหลด Google Analytics ก็ต่อเมื่อ:

1. ผู้ใช้ให้ความยินยอมต่อคุกกี้เพื่อการวิเคราะห์
2. มี `GA_MEASUREMENT_ID` จาก runtime config

หากผู้ใช้ยังไม่ยินยอม:

- จะไม่โหลด GA script
- จะไม่ยิง `page_view`
- จะไม่ยิง custom events

consent state ถูกเก็บใน `localStorage` key:

- `cookie_preferences_v1`

## Route Allowlist สำหรับ page_view

`page_view` จะถูกยิงเฉพาะ route ที่ตั้งใจเก็บเท่านั้น

### Route ที่อนุญาต

- `/`
- `/aboutus`
- `/contactus`
- `/form/:id`

### Route ที่ไม่เก็บ

- `/login`
- `/unauthorized`
- `/privacy`
- `/terms`
- `/cookies`

ระบบจะ dedupe route เดิมและไม่ยิง `page_view` ซ้ำหาก path เดิมเพิ่งถูก track ไปแล้ว

## Event Dictionary

รายการ event ที่อนุญาตให้ส่งมีดังนี้

| Event | Trigger | Allowed Params |
| --- | --- | --- |
| `login_started` | ผู้ใช้กดปุ่มเริ่ม login | `provider` |
| `unauthorized_viewed` | เปิดหน้าไม่มีสิทธิ์ใช้งานระบบ | ไม่มี |
| `degree_selected` | ผู้ใช้เลือกระดับการศึกษา | `degree_level` |
| `form_selected` | ผู้ใช้เลือกฟอร์ม | `form_code`, `degree_level`, `has_sub_types` |
| `form_subtype_selected` | ผู้ใช้เลือกประเภทย่อยของฟอร์ม | `form_code`, `degree_level`, `sub_type` |
| `form_step_viewed` | ผู้ใช้เห็น step ของแบบฟอร์ม | `form_code`, `degree_level`, `sub_type`, `step` |
| `chat_opened` | ผู้ใช้เปิดหน้าต่างแชต | `has_cached_usage` |
| `chat_message_sent` | ผู้ใช้ส่งข้อความเข้าแชต | `message_length_bucket` |
| `validation_started` | เริ่มตรวจสอบเอกสาร | `form_code`, `degree_level`, `sub_type`, `required_document_count` |
| `validation_succeeded` | ตรวจสอบเอกสารสำเร็จ | `form_code`, `degree_level`, `sub_type`, `required_document_count` |
| `validation_failed` | ตรวจสอบเอกสารล้มเหลว | `form_code`, `degree_level`, `sub_type`, `required_document_count`, `failure_stage` |
| `merge_started` | เริ่มรวมไฟล์ | `form_code`, `degree_level`, `sub_type` |
| `merge_succeeded` | รวมไฟล์สำเร็จ | `form_code`, `degree_level`, `sub_type`, `has_download_url`, `has_directory_fallback` |
| `merge_failed` | รวมไฟล์ล้มเหลว | `form_code`, `degree_level`, `sub_type` |

## ความหมายของค่าที่ใช้

### degree_level

ค่าที่ใช้ปัจจุบัน:

- `bachelor`
- `graduate`

### sub_type

- ใช้ค่าจาก static form configuration
- หากไม่มี sub type ให้ใช้ค่า `default`

### step

ค่าที่ใช้ในหน้า form detail:

- `1`
- `2`
- `3`

### message_length_bucket

ใช้แทนการส่งข้อความจริงของผู้ใช้:

- `short`
- `medium`
- `long`

### failure_stage

ค่าที่ใช้ปัจจุบัน:

- `preparation_partial`
- `validation_rules`
- `api_error`
- `network_error`

## การ sanitize ก่อนส่งเข้า GA

wrapper จะ sanitize parameter ตามกติกาต่อไปนี้:

- boolean: ส่งได้
- number: ส่งได้ถ้าเป็น finite number
- string: trim whitespace และตัดความยาวไม่เกิน 64 ตัวอักษร
- ค่าที่ไม่อยู่ใน whitelist schema ของ event จะไม่ถูกส่ง

## ไฟล์หลักที่เกี่ยวข้อง

- [analytics.js](/Users/pst./senior/frontend/src/lib/analytics.js)
- [App.jsx](/Users/pst./senior/frontend/src/App.jsx)
- [home.jsx](/Users/pst./senior/frontend/src/pages/home.jsx)
- [Formdetail.jsx](/Users/pst./senior/frontend/src/pages/Formdetail.jsx)
- [Login.jsx](/Users/pst./senior/frontend/src/pages/Login.jsx)
- [Unauthorized.jsx](/Users/pst./senior/frontend/src/pages/Unauthorized.jsx)
- [CookieConsentManager.jsx](/Users/pst./senior/frontend/src/components/CookieConsentManager.jsx)

## แนวทางการเพิ่ม event ใหม่ในอนาคต

ก่อนเพิ่ม event ใหม่ ต้องตอบคำถามนี้ให้ครบ:

1. Event นี้ช่วยตอบคำถามทาง product หรือ UX จริงหรือไม่
2. Event นี้สามารถใช้ metadata-only ได้หรือไม่
3. มีโอกาสส่ง PII หรือ user-generated content หรือไม่
4. สามารถแทนค่าละเอียดด้วย bucket/category ได้หรือไม่

ขั้นตอนที่ต้องทำ:

1. เพิ่มชื่อ event และ whitelist params ใน [analytics.js](/Users/pst./senior/frontend/src/lib/analytics.js)
2. อัปเดตเอกสารฉบับนี้
3. ทดสอบว่า event ไม่ยิงก่อน consent
4. ทดสอบว่า params ที่ส่งไม่มี PII

## สิ่งที่ไม่ควรทำ

- ห้าม track ข้อความค้นหาจริง
- ห้าม track ข้อความแชตจริง
- ห้าม track ชื่อไฟล์หรือชื่อเอกสารที่ผู้ใช้อัปโหลด
- ห้ามส่ง backend error message แบบดิบเข้า analytics
- ห้ามเพิ่ม event ผ่าน `window.gtag()` ตรง ๆ ใน component

## สถานะปัจจุบัน

เอกสารนี้สอดคล้องกับ implementation ปัจจุบัน ณ วันที่เพิ่มไฟล์นี้ และควรอัปเดตทุกครั้งเมื่อมีการ:

- เพิ่ม event ใหม่
- เปลี่ยน route allowlist/blocklist
- เปลี่ยน consent model
- เปลี่ยน param schema ของ event ใด event หนึ่ง
