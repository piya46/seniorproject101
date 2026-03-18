# Key Rotation Runbook

เอกสารนี้เป็น runbook สั้นสำหรับทีม ops ที่ต้องเปลี่ยน app-level encryption key/certificate ของระบบ Sci-Request

หมายเหตุสำคัญ:

- key ชุดนี้ใช้สำหรับ `/api/v1/auth/public-key` และ hybrid encryption ของ request/response
- key ชุดนี้ไม่ใช่ TLS certificate ของ load balancer หรือ `run.app`
- ถ้าเปลี่ยนเฉพาะ HTTPS certificate ของโดเมน ไม่จำเป็นต้อง rotate key ชุดนี้เสมอไป

## Secrets ที่เกี่ยวข้อง

Active slot:

- `Gb_PRIVATE_KEY_BASE64`
- `Gb_PUBLIC_KEY_BASE64`

Previous slot สำหรับช่วง transition:

- `Gb_PREVIOUS_PRIVATE_KEY_BASE64`
- `Gb_PREVIOUS_PUBLIC_KEY_BASE64`

ค่าฝั่ง public รับได้ทั้ง:

- public key PEM (`BEGIN PUBLIC KEY`)
- certificate PEM (`BEGIN CERTIFICATE`)

## กรณีที่ 1: ต่ออายุ certificate จาก key เดิม

ใช้กรณีที่ CA ออก certificate ใหม่ให้ แต่ private key เดิมยังใช้อยู่

ขั้นตอน:

1. backup ค่า secret ปัจจุบัน
2. update `Gb_PUBLIC_KEY_BASE64` ด้วย certificate/public key ใหม่
3. คง `Gb_PRIVATE_KEY_BASE64` เดิมไว้
4. deploy ใหม่ด้วย [deploy.sh](/Users/pst./senior/backend/deploy.sh)
5. ตรวจ startup log ว่าโหลด key สำเร็จและ certificate ยังไม่หมดอายุ

ตัวอย่าง:

```bash
echo -n "$NEW_CERT_PEM" | base64
gcloud secrets versions add Gb_PUBLIC_KEY_BASE64 --data-file=-
./deploy.sh
```

## กรณีที่ 2: เปลี่ยนไปใช้ key pair ใหม่

ใช้กรณีที่ CA ออก certificate ใหม่พร้อม key pair ใหม่ หรือทีม security ต้องการ rotate แบบเต็มชุด

ขั้นตอน:

1. backup key/cert ปัจจุบัน
2. update active slot เป็นคู่ใหม่
3. ย้ายคู่เก่าไป previous slot
4. deploy ใหม่
5. รอช่วง transition
6. ลบ previous slot เมื่อมั่นใจแล้ว

รายละเอียด:

### Step 1. Backup ค่าเดิม

เก็บค่าเดิมของ:

- `Gb_PRIVATE_KEY_BASE64`
- `Gb_PUBLIC_KEY_BASE64`

### Step 2. ใส่คู่ใหม่เป็น active slot

- `Gb_PRIVATE_KEY_BASE64` = private key ใหม่
- `Gb_PUBLIC_KEY_BASE64` = certificate ใหม่ หรือ public key ใหม่

### Step 3. ใส่คู่เก่าเป็น previous slot

- `Gb_PREVIOUS_PRIVATE_KEY_BASE64` = private key เก่า
- `Gb_PREVIOUS_PUBLIC_KEY_BASE64` = certificate/public key เก่า

ตัวอย่าง:

```bash
gcloud secrets versions add Gb_PRIVATE_KEY_BASE64 --data-file=-
gcloud secrets versions add Gb_PUBLIC_KEY_BASE64 --data-file=-
gcloud secrets versions add Gb_PREVIOUS_PRIVATE_KEY_BASE64 --data-file=-
gcloud secrets versions add Gb_PREVIOUS_PUBLIC_KEY_BASE64 --data-file=-
```

### Step 4. Deploy

รัน:

```bash
cd /Users/pst./senior/backend
./deploy.sh
```

`deploy.sh` จะผูก previous slot เข้า Cloud Run ให้อัตโนมัติ ถ้ามี secret `Gb_PREVIOUS_*` อยู่แล้ว

### Step 5. Transition window

ช่วงนี้:

- request ใหม่จะใช้ public key ใหม่
- request เก่าที่เข้ารหัสด้วย key เดิมยัง decrypt ได้ผ่าน previous private key

แนะนำให้รอจนแน่ใจว่า:

- frontend เวอร์ชันเก่าหรือ browser tab เก่าหมดรอบแล้ว
- ไม่มี request ที่ยังอาศัย public key เก่าอยู่

### Step 6. Cleanup previous slot

เมื่อมั่นใจแล้ว:

1. ลบ secret previous slot หรือหยุดผูกกับ runtime
2. deploy อีกรอบ

## Checklist หลัง deploy

ตรวจอย่างน้อย:

- `GET /api/v1/auth/public-key` ตอบกลับได้
- startup log มี `Active Key Slot: current`
- ถ้ามี previous slot จะเห็น `Key Rotation Fallback: ENABLED`
- ถ้าใช้ certificate PEM จะเห็น `Active Certificate Valid To: ...`
- flow `session/init` ทำงานได้
- flow `validation/check-completeness` ทำงานได้
- flow `documents/merge` ทำงานได้

## Rollback

ถ้าคู่ใหม่มีปัญหา:

1. เอาคู่เก่ากลับมาไว้ที่ active slot
2. deploy ใหม่
3. ตรวจ `/api/v1/auth/public-key` และ flow หลักอีกครั้ง

Rollback ที่ปลอดภัยที่สุดคือ:

- `Gb_PRIVATE_KEY_BASE64` = private key เก่า
- `Gb_PUBLIC_KEY_BASE64` = public key/cert เก่า

## สิ่งที่ห้ามทำ

- ห้ามใส่ certificate/public key ใหม่ที่ไม่ตรงกับ private key active
- ห้ามลบ previous slot ทันทีถ้ายังมีโอกาสที่ client ใช้ public key เก่า
- ห้ามสับสนระหว่าง TLS cert ของ LB/IAP กับ app-level encryption key ของระบบนี้
