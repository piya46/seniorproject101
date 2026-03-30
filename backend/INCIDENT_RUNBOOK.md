# Incident Runbook

Last updated: `2026-03-30`

runbook นี้สรุป threat model แบบสั้นและแนวทางตอบสนอง incident สำหรับ 3 พื้นที่ที่สำคัญที่สุดในระบบตอนนี้: upload path, Google OIDC, และ AI usage abuse

## Upload Path

Threat model:

- attacker ยิง upload พร้อมกันจำนวนมากเพื่อดัน memory หรือ temp disk
- attacker อัปโหลดไฟล์ปลอม MIME / polyglot file เพื่อหลบ signature check
- attacker พยายามใช้ encrypted upload ที่ malformed เพื่อทำให้ decrypt path ล้มถี่ ๆ

สัญญาณเตือน:

- Cloud Run instance restart บ่อยผิดปกติ
- latency ของ `/api/v1/upload` สูงขึ้นหรือ error 400/500 พุ่ง
- temp disk usage ใน container สูงผิดปกติ
- log event `upload_handler_error` หรือ decryption failure ถี่ขึ้น

การตอบสนอง:

1. เปิด Cloud Logging filter ที่ route `/api/v1/upload` แล้วดูอัตรา `400`, `403`, `429`, `500`
2. เช็กว่า rate limit hit สูงขึ้นหรือไม่ และดูว่า pattern มาจาก session เดิมหรือหลาย session
3. ถ้าสงสัยว่า temp files ค้างจาก crash ให้ redeploy revision ใหม่หรือ restart service เพื่อให้ startup cleanup ทำงาน
4. ถ้าเป็น abuse ชัดเจน ให้ลด upload limit ชั่วคราวหรือ block origin/session ที่ผิดปกติ
5. ถ้ามีไฟล์ต้องสงสัย ให้เก็บเฉพาะ metadata ใน log หลีกเลี่ยง dump file content ลง log

การป้องกันที่มีอยู่แล้ว:

- multer disk storage ไป `/tmp`
- decrypt แบบ stream
- file signature validation
- browser origin allowlist
- Firestore-backed rate limit
- cleanup temp files ทั้งใน `finally` และตอน startup

## Google OIDC

Threat model:

- attacker พยายาม spoof identity หรือ callback
- callback URL/config drift ทำให้ login พังหรือ redirect ไป endpoint ที่ไม่ตั้งใจ
- session fixation / CSRF หลัง login

สัญญาณเตือน:

- login fail เพิ่มขึ้นผิดปกติ
- `403` จาก csrf validation หลัง login จำนวนมาก
- callback mismatch หรือ redirect URI error จาก Google
- audit events ฝั่ง login/logout ผิด pattern เช่น fail จำนวนมากจาก IP เดิม

การตอบสนอง:

1. ตรวจว่าถ้าใช้ production BFF flow Google OAuth redirect URI ตรงกับ frontend callback (`/auth/callback`) แบบ exact match
2. ถ้ายังใช้ legacy/direct mode ค่อยตรวจ `GOOGLE_OIDC_CALLBACK_URL` และ backend callback ให้ตรงกัน
3. เปิดดู log ของ `/api/v1/oidc/*`, `/api/v1/auth/csrf-token`, `/api/v1/session/init`
4. ถ้าพบ login fail เป็นวงกว้างหลัง deploy ให้เทียบ deploy config ล่าสุดกับ callback URL ที่ใช้งานจริง
5. ถ้าสงสัย session/csrf issue ให้ยืนยันว่า browser ได้ทั้ง `sci_session_token` และ `sci_csrf_token` และ frontend/BFF ส่ง `x-csrf-token`
6. ถ้ามีความเสี่ยง account abuse ให้บังคับ logout โดย rotate JWT secret ตามขั้นตอนปฏิบัติการที่ทีมยอมรับได้

การป้องกันที่มีอยู่แล้ว:

- Google OIDC domain restrictions
- anti-CSRF แบบ double submit cookie
- session regeneration พร้อม CSRF rotation
- browser origin/referrer checks
- structured audit logging พร้อม request id

## AI Usage Abuse

Threat model:

- user พยายามใช้ AI endpoint หนักผิดปกติเพื่อเผา token quota หรือค่าใช้จ่าย
- script ยิง request จำนวนมากเพื่อ bypass usage intent ระดับมนุษย์
- misuse ใน flow บาง route จน failure rate สูงและกิน cost โดยไม่เกิด business value

สัญญาณเตือน:

- `429` จาก AI daily token limit เพิ่มขึ้นเร็ว
- `AI_USAGE_DAILY.total_tokens` หรือ `request_count` ของบาง user สูงผิดปกติ
- `failure_count` สูงต่อเนื่องใน route เดิม
- model cost สูงขึ้นแต่ success rate ต่ำ

การตอบสนอง:

1. เปิด Firestore collection `AI_USAGE_DAILY`
2. filter `date_key == "<today>"`
3. sort ตาม `total_tokens desc` เพื่อหา heavy users
4. sort ตาม `failure_count desc` เพื่อหา abuse หรือ broken flow
5. ถ้าจำเป็น ให้ลด `AI_DAILY_TOKEN_LIMIT` ชั่วคราวแล้ว redeploy
6. ถ้าเป็น user เฉพาะราย ให้ block session/account ตาม policy ของระบบ

การป้องกันที่มีอยู่แล้ว:

- per-user/session daily token cap
- structured audit logging
- daily aggregate usage ใน Firestore
- retention ผ่าน `AI_USAGE_RETENTION_DAYS`

## Evidence Checklist

- เก็บ request id, route, status code, session id, email, และ event name
- หลีกเลี่ยงการเก็บ plaintext payload, decrypted file content, token จริง, หรือ secret ลง incident notes
- ถ้าต้อง share ข้ามทีม ให้ share เฉพาะ log excerpt และ Firestore metadata ที่จำเป็น
