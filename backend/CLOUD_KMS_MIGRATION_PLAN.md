# Cloud KMS Migration Plan

Last updated: `2026-03-27`

เอกสารนี้อธิบายแผนย้าย crypto flow ปัจจุบันจากการถือ private key ใน runtime ไปสู่ Google Cloud KMS โดยพยายามไม่ทำให้ public API contract เดิมพัง

## เป้าหมาย

- ลดการถือ private key จริงใน process memory ของแอป
- คง endpoint และ frontend contract เดิมไว้ให้มากที่สุด
- ทำ migration แบบ phased rollout และ rollback ได้

## สถานะปัจจุบัน

ตอนนี้ระบบใช้ RSA private key จาก runtime env/secrets เพื่อ:

- ถอด `encKey` ของ secure JSON request
- ถอด `encKey` ของ encrypted file upload
- validate key pair ตอน startup
- เสิร์ฟ public key ผ่าน `GET /api/v1/auth/public-key`

ไฟล์ที่ผูกกับ flow ปัจจุบันโดยตรง:

- [cryptoUtils.js](/Users/pst./senior/backend/utils/cryptoUtils.js)
- [uploadRoutes.js](/Users/pst./senior/backend/routes/uploadRoutes.js)
- [app.js](/Users/pst./senior/backend/app.js)
- [deploy.sh](/Users/pst./senior/backend/deploy.sh)
- [KEY_ROTATION.md](/Users/pst./senior/backend/KEY_ROTATION.md)

## เป้าหมายสถาปัตยกรรมหลังย้าย

ให้แอปมี abstraction สำหรับ key provider 2 แบบ:

1. `env` provider
2. `cloud-kms` provider

ผลลัพธ์ที่ต้องการ:

- frontend ยังเรียก `GET /api/v1/auth/public-key` เหมือนเดิม
- secure JSON request/response format เดิมไม่เปลี่ยน
- upload encryption flow เดิมไม่เปลี่ยน
- deploy สามารถเลือก provider ผ่าน env ได้

## Phase 1: Introduce Provider Abstraction

เป้าหมาย:

- แยก logic crypto ออกจากการอ่าน key material ตรง ๆ จาก `process.env`
- เพิ่ม config เช่น `CRYPTO_KEY_PROVIDER=env|cloud-kms`

ไฟล์ที่ต้องเปลี่ยน:

- [cryptoUtils.js](/Users/pst./senior/backend/utils/cryptoUtils.js)
  - แยก `loadKeySlots()` ออกเป็น provider-specific loader
  - แยก `tryDecryptWithPrivateKey()` ออกเป็น interface เช่น `decryptEnvelopeKey(encKeyBase64)`
  - แยก `getPublicKey()` ออกเป็น provider-specific public key resolver
- [app.js](/Users/pst./senior/backend/app.js)
  - ปรับ required env/check ให้รองรับทั้ง env provider และ KMS provider
- [uploadRoutes.js](/Users/pst./senior/backend/routes/uploadRoutes.js)
  - เลิกเรียก `crypto.privateDecrypt()` ตรงใน route
  - ให้เรียก helper กลางจาก `cryptoUtils.js` แทน

เหตุผล:

- Phase นี้ยังไม่แตะ KMS จริง แต่ทำให้ runtime มี seam ที่พร้อมเปลี่ยน backend ของ key management

## Phase 2: Add Cloud KMS Provider

เป้าหมาย:

- ใช้ asymmetric decryption key ใน Cloud KMS สำหรับถอด `encKey`
- ใช้ public key จาก KMS key version เป็น public key เดียวกับที่ frontend ดึงไปเข้ารหัส

ไฟล์ที่ต้องเพิ่ม/แก้:

- เพิ่มไฟล์ใหม่ เช่น `utils/kmsCryptoProvider.js`
  - โหลด KMS config เช่น project/location/keyRing/key/keyVersion
  - ดึง public key จาก KMS
  - เรียก KMS asymmetric decrypt สำหรับ `encKey`
- [cryptoUtils.js](/Users/pst./senior/backend/utils/cryptoUtils.js)
  - route traffic ไป provider ที่เลือก
- [routes/authRoutes.js](/Users/pst./senior/backend/routes/authRoutes.js)
  - คง `GET /auth/public-key` ไว้ แต่ source ของ public key เปลี่ยนเป็น KMS เมื่อเปิด provider นี้

## Phase 3: Keep Rotation / Rollback Safety

เป้าหมาย:

- rollout แบบ canary ได้
- rollback กลับ env provider ได้ทันทีถ้า KMS latency/permission มีปัญหา

แนวทาง:

- ให้ `CRYPTO_KEY_PROVIDER=env` เป็น default ช่วงแรก
- deploy code ที่รองรับทั้งสอง provider ก่อน
- ทดสอบ KMS provider ใน staging
- ค่อย flip production env เป็น `cloud-kms`
- เก็บ env-based secret path ไว้ชั่วคราวเพื่อ rollback

## Files And Areas To Change

### 1. Runtime crypto

- [cryptoUtils.js](/Users/pst./senior/backend/utils/cryptoUtils.js)
  - จุดรวมของ key loading, public key exposure, decrypt envelope key

### 2. Upload decryption path

- [uploadRoutes.js](/Users/pst./senior/backend/routes/uploadRoutes.js)
  - ปัจจุบันถอด RSA ใน route โดยตรง
  - ควรเปลี่ยนให้ใช้ helper กลางจาก crypto layer

### 3. Startup validation

- [app.js](/Users/pst./senior/backend/app.js)
  - required env ปัจจุบันยังบังคับ `Gb_PRIVATE_KEY_BASE64` และ `Gb_PUBLIC_KEY_BASE64`
  - ต้องเปลี่ยนให้ conditional ตาม provider

### 4. Deploy/bootstrap

- [deploy.sh](/Users/pst./senior/backend/deploy.sh)
  - เพิ่ม env/config สำหรับ KMS provider
  - แยก path ของ env provider กับ KMS provider ให้ชัด

### 5. Operational docs

- [KEY_ROTATION.md](/Users/pst./senior/backend/KEY_ROTATION.md)
  - ตอนนี้อิง secret-based key rotation
  - ต้องเพิ่ม section สำหรับ KMS key version rollout
- [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)
  - เพิ่ม runtime config และ smoke checks ของ KMS path

## IAM / Permissions Required

อย่างน้อย app service account ต้องมี:

- `roles/cloudkms.cryptoKeyDecrypter` บน KMS key ที่ใช้ถอด `encKey`

ถ้า runtime ต้องดึง public key จาก KMS key version โดยตรง ให้มีอย่างน้อย:

- `roles/cloudkms.publicKeyViewer`

แนวทางที่แนะนำ:

- grant role ระดับ key ให้แคบที่สุด ไม่ให้ระดับ project ถ้าไม่จำเป็น
- แยก key ring/key สำหรับ production และ staging

## Deploy / Config Additions

ค่าที่น่าจะต้องเพิ่ม:

- `CRYPTO_KEY_PROVIDER=env|cloud-kms`
- `KMS_KEY_PROJECT_ID`
- `KMS_KEY_LOCATION`
- `KMS_KEY_RING`
- `KMS_KEY_NAME`
- `KMS_KEY_VERSION`

rollback switch:

- กลับไป `CRYPTO_KEY_PROVIDER=env`

## Smoke Checks After Migration

หลังเปิด KMS provider ควรเช็กอย่างน้อย:

1. `GET /api/v1/auth/public-key`
2. encrypted `POST /api/v1/session/init`
3. encrypted upload path ที่ต้อง decrypt file key
4. merge/validation/chat flow ปกติ
5. latency และ error rate ของ KMS calls ใน Cloud Logging

## Recommendation

ลำดับที่ปลอดภัยที่สุดคือ:

1. ทำ provider abstraction ให้เสร็จก่อน
2. ย้าย upload route ให้ไม่ทำ RSA decrypt เอง
3. เพิ่ม KMS provider แบบปิดด้วย env
4. ทดสอบ staging
5. ค่อยเปิด production ทีหลัง
