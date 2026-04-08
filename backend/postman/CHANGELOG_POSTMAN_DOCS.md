# Changelog Postman Docs

Current version: `v1.10.1`
Last updated: `2026-04-08`

## v1.10.1

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- อัปเดต API examples และ Postman collection ให้ระบุสถานะคิวของ document jobs ครบทั้ง `queued`, `processing`, `succeeded`, `partial_failed`, `failed`
- เพิ่มตัวอย่าง response สำหรับ merge job status ในกรณี `queued` พร้อม `queue_info` และกรณี `partial_failed`
- sync README และเอกสารประกอบให้ตรงกับพฤติกรรมจริงของ backend worker queue

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการอัปเดตเอกสารและ examples ให้ตรงกับ implementation ปัจจุบัน

ผลกระทบฝั่งทีม:

- frontend/client สามารถอ้างอิง docs ชุดนี้เพื่อรองรับการแสดงผลสถานะคิวและข้อความรอคิวได้ครบขึ้น
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.10.1`

## v1.10.0

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เปลี่ยน flow ดาวน์โหลด merged document เป็น backend-streaming แบบ zero-trust
- `GET /documents/jobs/:jobId/download` ตอนนี้คืน `download_path` แทน signed URL
- เพิ่มการอธิบาย `GET /documents/jobs/:jobId/file` สำหรับ stream merged PDF ผ่าน backend
- ลบตัวอย่าง response ที่เผย `download_url`, `merged_file_name`, และ `merged_download_url_ttl_ms` ออกจากเอกสาร/collection
- sync frontend integration guide และ API examples ให้ตรงกับ flow ใหม่

Breaking change:

- endpoint `/documents/jobs/:jobId/download` เปลี่ยน response contract จาก `download_url` เป็น `download_path`
- client ที่ใช้ signed URL จาก storage โดยตรงต้องปรับมาเปิด backend download path แทน

ผลกระทบฝั่งทีม:

- frontend ต้องเปิด `download_path` จาก backend แทนการใช้ signed URL จาก storage
- job status response จะไม่เปิดเผย storage object path ภายในอีกต่อไป
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.10.0`

## v1.9.9

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- ตรวจทานทั้งโฟลเดอร์ `backend/postman/` อีกรอบและ sync เอกสารกับ implementation ปัจจุบันให้ครบ
- แก้ `production` Postman environment ให้ชี้ backend `run.app` ปัจจุบันของระบบ
- เพิ่มตัวแปรช่วยใน environment files เช่น `backendBaseOrigin`, `frontendBaseOrigin`, `frontendAuthCallbackUrl`, `legacyOidcCallbackUrl`, และ `returnToUrl`
- ลบตัวแปรซ้ำใน collection/environment และ sync example response ที่ยังอ้าง service metadata เก่า
- อัปเดต `examples/api-client.ts` ให้มี `getChatUsage()` และ `logout()` ตาม endpoint/behavior ล่าสุด

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็น release เอกสารเพื่อเก็บ audit และ sync environment/examples ให้ตรงกับระบบจริง

ผลกระทบฝั่งทีม:

- ทีมที่ import environment ใหม่จะได้ `production baseUrl` ที่ตรงกับ backend ปัจจุบันทันที
- ทีม frontend จะมีตัวแปร callback/origin สำหรับเทส OIDC ชัดขึ้น
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.9`

## v1.9.8

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่มเอกสาร `GET /api/v1/chat/usage` สำหรับ usage summary ของ AI chat quota widget
- sync `POST /api/v1/oidc/logout` ให้ตรงกับ runtime ล่าสุด รวมพฤติกรรม `Clear-Site-Data`
- sync collection ให้มี `GET /api/v1/system/status/storage-signing` แบบ authenticated probe ตาม implementation จริง
- อัปเดต guide/collection summary ว่า response หลัง authenticated middleware ถูกตั้ง `no-store/no-cache`
- อัปเดต Postman environments โดยแก้ production `baseUrl` ให้ตรง backend `run.app` ปัจจุบัน, ลบตัวแปรซ้ำ, และเพิ่มตัวแปรช่วยเรื่อง frontend/backend origins กับ callback URLs
- regenerate printable docs ให้ตรงกับ `API_DOCUMENTATION.md` เวอร์ชันล่าสุด

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการ sync docs/collection/examples ให้ตรงกับ behavior ปัจจุบันมากขึ้น

ผลกระทบฝั่งทีม:

- frontend สามารถเรียก `GET /api/v1/chat/usage` เพื่อแสดงสถานะโควต้า AI ได้โดยไม่ต้องรอ request แชตครั้งแรก
- flow logout ควรคาดหวัง browser-side cache/storage clearing ใน browser ที่รองรับ และไม่ควร rely on cached authenticated responses
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.8`

## v1.9.7

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่ม `POST /api/v1/profile/details` สำหรับข้อมูลส่วนตัวที่ต้องใช้ secure JSON transport
- คง `GET /api/v1/profile/me` ไว้เป็น summary/safe profile สำหรับ UI binding ทั่วไป
- อธิบาย policy ใหม่ให้ชัดว่าข้อมูลส่วนตัวที่เข้มขึ้นควรใช้ encrypted route

Breaking change:

- ไม่มี breaking change ของ API runtime เดิม; เป็นการเพิ่ม encrypted profile details route ใหม่

ผลกระทบฝั่งทีม:

- frontend ควรใช้ `GET /api/v1/profile/me` สำหรับ summary binding
- ถ้าต้องดึง personal profile ที่เข้มขึ้น ให้ใช้ `POST /api/v1/profile/details` พร้อม secure JSON และ CSRF
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.7`

## v1.9.6

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่ม `GET /api/v1/profile/me` สำหรับ safe profile binding บน frontend UI
- แยกบทบาทของ `GET /api/v1/oidc/me` กับ `GET /api/v1/profile/me` ให้ชัดขึ้น
- อัปเดต integration/docs ให้ยึด profile allowlist response แทนการคาดหวังข้อมูล internal identity ทั้งก้อน

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการเพิ่ม endpoint ใหม่และ sync เอกสารให้ตรงกับ profile binding model ปัจจุบัน

ผลกระทบฝั่งทีม:

- frontend ควรใช้ `GET /api/v1/profile/me` เป็น source of truth สำหรับ profile card หรือ personal info binding
- `GET /api/v1/oidc/me` ควรใช้สำหรับ session/auth state check เป็นหลัก
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.6`

## v1.9.5

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- ปรับเอกสารหลักให้ production auth flow ยึด frontend BFF เป็นค่าหลักแทน legacy/direct mode
- เพิ่มคำอธิบาย BFF bridge routes คือ `GET /api/v1/oidc/bff/google/login-url` และ `GET /api/v1/oidc/bff/google/callback`
- อัปเดต runbook/security/integration docs ให้ชี้ว่า Google redirect URI ของ production BFF flow ควรจบที่ frontend `/auth/callback`
- ปรับ BFF contract ให้สะท้อน implementation ปัจจุบันที่ใช้ cookie-backed backend session เป็นหลัก และ trusted forwarded user headers เป็น fallback/advanced mode

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการ sync เอกสารให้ตรงกับ backend implementation ปัจจุบัน

ผลกระทบฝั่งทีม:

- ทีมที่ใช้ production private backend ควรอ้างอิง frontend callback และ BFF bridge flow จาก docs ชุดนี้
- ถ้ายังใช้ legacy/direct mode ให้ถือว่าเป็น backward compatibility path ไม่ใช่ production target หลัก
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.5`

## v1.9.4

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่ม `GET /api/v1/system/status/storage-signing` ใน API docs/examples/collection ให้ตรงกับ endpoint จริง
- sync ถ้อยคำเรื่อง `FRONTEND_EXTRA_URLS` ให้ใช้เป็น temporary dev/QA override เท่านั้น
- เพิ่มคำสั่ง deploy แบบ copy/paste ใน deploy runbook ให้ตรงกับ `deploy.sh`
- อัปเดต Postman guide และ collection summary ให้สะท้อน status endpoints ชุดปัจจุบัน

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการ sync เอกสารและ metadata ของ collection ให้ตรงกับระบบปัจจุบัน

ผลกระทบฝั่งทีม:

- QA/ops สามารถใช้ `GET /api/v1/system/status/storage-signing` เป็น smoke probe เพิ่มได้หลัง deploy
- ถ้าจะอ้างอิง deploy command ให้ยึด runbook เวอร์ชันนี้เป็นหลัก
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.4`

## v1.9.3

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่มเอกสาร flow `GET /api/v1/auth/csrf-token` ให้ตรงกับ anti-CSRF enforcement ปัจจุบัน
- อัปเดต auth flow ใน API docs/examples/Postman guide ให้เรียก CSRF token ก่อน `POST /session/init` และก่อน state-changing requests อื่น
- เพิ่มคำอธิบายเรื่อง `AI_USAGE_DAILY` และ retention ผ่าน `AI_USAGE_RETENTION_DAYS`
- ยืนยันใน docs ว่า usage analytics ตอนนี้ดูตรงจาก Firestore Console ไม่ได้เปิด admin report endpoint ในแอป

Breaking change:

- ฝั่ง client/browser ที่ใช้ session cookie ต้องแนบ `x-csrf-token` กับ state-changing requests ตาม flow ใหม่

ผลกระทบฝั่งทีม:

- frontend/QA/Postman ต้องเรียก `GET /api/v1/auth/csrf-token` หลัง login สำเร็จ
- ถ้าจะ inspect AI usage ให้เปิดดู collection `AI_USAGE_DAILY` ใน Firestore แทนการคาดหวัง report endpoint
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.3`

## v1.9.2

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- แยก `GET /api/v1/system/status` ให้เป็น public liveness endpoint แบบ minimal
- เพิ่ม `GET /api/v1/system/status/details` สำหรับ internal QA/ops หลัง authenticated session พร้อมแล้ว
- อัปเดต examples, runbook, security docs, และ printable docs ให้ตรงกับ status model ใหม่
- คง AI runtime guidance เป็น `AI_LOCATION=us-central1`

Breaking change:

- ไม่มี breaking change ของ API runtime หลัก แต่ public status response ถูกลดข้อมูลลงอย่างตั้งใจ

ผลกระทบฝั่งทีม:

- ถ้าทีมต้องการดู runtime/config เชิงลึก ให้ใช้ `GET /api/v1/system/status/details` หลัง login แทนการคาดหวังข้อมูลจาก public status
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.2`

หมายเหตุ:

- section ตั้งแต่ `v1.8.5` ลงไปเป็นประวัติย้อนหลังของยุค IAP/LB เดิม
- production source of truth ปัจจุบันคือ `v1.9.2` และเอกสารชุด OIDC-only เท่านั้น

## v1.9.1

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- อัปเดตเอกสารให้ยึด Cloud Run `run.app` แบบ regional เป็น canonical backend URL
- เพิ่มคำอธิบายเรื่อง Google OAuth callback ให้ตรงกับ `deploy.sh` ที่ตั้ง `GOOGLE_OIDC_CALLBACK_URL` อัตโนมัติ
- sync ตัวอย่าง dev origins ให้ตรงกับ workflow ปัจจุบันคือ `http://localhost:5173` และ `http://127.0.0.1:5500`

Breaking change:

- ไม่มี breaking change ของ API runtime; เป็นการ sync docs และ deployment guidance ให้ตรงกับ production ปัจจุบัน

ผลกระทบฝั่งทีม:

- Google OAuth client ควรใช้ redirect URI แบบ exact match เป็น `https://sci-request-system-466086429766.asia-southeast3.run.app/api/v1/oidc/google/callback`
- frontend/local QA ควรใช้ origin allowlist ตามค่าปัจจุบันใน runbook และ integration guide

## v1.9.0

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เปลี่ยนชุดเอกสารและ collection หลักเป็น Google OIDC แบบ in-app
- แทนที่ endpoint กลุ่มเดิมด้วย `GET /oidc/google/login`, `GET /oidc/me`, และ `POST /oidc/logout`
- อัปเดต API summary, examples, runbook, และ printable docs ให้รองรับ direct Cloud Run + custom domain
- ปรับเอกสาร security ให้ระบุชัดว่า migration นี้ลด defense-in-depth จากระบบเดิมที่มี IAP อยู่หน้า backend

Breaking change:

- production auth flow ใน docs เปลี่ยนจาก IAP-based เป็น OIDC-based

ผลกระทบฝั่งทีม:

- frontend ต้องเริ่ม login ผ่าน `GET /api/v1/oidc/google/login?return_to=<frontend-url>`
- frontend ควรตรวจ session ด้วย `GET /api/v1/oidc/me` และเรียก `POST /api/v1/oidc/logout` เมื่อต้องการ sign out
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.9.0`

## v1.8.5

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่ม `GET /iap/complete` สำหรับ flow ที่ให้ backend จบ IAP login และสร้าง session ก่อน redirect กลับ frontend
- อัปเดต API summary และ runbook ให้รองรับสถาปัตยกรรม `frontend = pstpyst.com`, `backend = api.pstpyst.com`
- อัปเดต QA scaffold และ production Postman environment ให้ใช้ `api.pstpyst.com` หลัง IAP
- ลด docs ให้เหลือเฉพาะ production flow ที่ใช้งานจริง และถอด compatibility route ออกจากชุดเอกสารหลัก

Breaking change:

- ไม่มี breaking change ของ endpoint เดิม แต่มี endpoint ใหม่สำหรับ frontend login gate

ผลกระทบฝั่งทีม:

- frontend ที่ต้องการบังคับ login ก่อนใช้งาน ควร redirect ไป `GET /api/v1/iap/complete?return_to=<frontend-url>` และใช้ `GET /api/v1/iap/me` เพื่อตรวจสถานะหลังกลับมา
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.8.5`

## v1.8.4

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- อัปเดต support endpoint ให้ไม่ส่ง `target_email` กลับใน success response เพราะอีเมลปลายทางเป็นค่า server-managed
- ปรับเอกสารให้ตรงกับ email format ใหม่ที่ซ่อนปลายทางและใช้ subject ส่งจริงเป็นแนว `แจ้งปัญหา`
- bump docs version เพื่อสะท้อนการเปลี่ยนแปลงของ support contract และตัวอย่าง response

Breaking change:

- success response ของ `POST /support/technical-email` ไม่มี field `target_email` แล้ว

ผลกระทบฝั่งทีม:

- frontend/QA ที่อ่าน response ของ support endpoint ต้องเลิกอ้างอิง `data.target_email`
- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.8.4`

## v1.8.3

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- เพิ่มตัวอย่าง React เพิ่มเติมสำหรับการใช้งาน API ฝั่ง frontend
- เพิ่มตัวอย่าง `axios + @tanstack/react-query` เพื่อให้ทีม frontend หยิบไปใช้กับ data layer ได้เร็วขึ้น
- เพิ่ม script สร้างไฟล์ `printable-api-docs.html` สำหรับเปิดใน browser แล้ว `Print -> Save as PDF`
- อัปเดต README ของโฟลเดอร์ Postman ให้ชี้ไปยังไฟล์ตัวอย่างและ workflow ใหม่ครบขึ้น

Breaking change:

- ไม่มี breaking change ของ API runtime หรือ Postman contract

ผลกระทบฝั่งทีม:

- ถ้าจะ publish/release docs รอบนี้ ให้ใช้ tag `docs/v1.8.3`
- ทีม frontend สามารถเริ่มจาก `examples/react-examples.tsx` หรือ `examples/react-query-examples.tsx` ได้ทันที

## v1.8.2

สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:

- bump เวอร์ชัน docs เพื่อให้งาน publish/release ตรงกับ tag ใหม่หลังแก้เอกสารและ workflow แล้ว
- คงการอัปเดต docs ที่ทำให้ `upload` และ `support` ตรงกับ implementation ล่าสุด
- คงการปรับ workflow path filters ให้ครอบคลุม `API_DOCUMENTATION.md` และ scripts ที่ใช้ sync/bump docs

Breaking change:

- ไม่มี breaking change ของ API runtime หรือ Postman contract

ผลกระทบฝั่งทีม:

- ใช้ tag `docs/v1.8.2` กับ commit ที่มี collection version `v1.8.2` จริง
- ถ้ามีการ bump docs ครั้งถัดไป release notes จะถูก generate จาก section นี้

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
- อัปเดต QA page ให้มีฟอร์มทดสอบ Technical Support email
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
