# Deploy Runbook

เอกสารนี้เป็น runbook สั้นสำหรับทีม ops ที่ต้อง deploy ระบบ `sci-request-system` ในโปรเจกต์จริง โดยเน้นขั้นตอนใช้งานจาก [deploy.sh](/Users/pst./senior/backend/deploy.sh)

## ก่อนเริ่ม

ตรวจให้พร้อมอย่างน้อย:

- อยู่ในโปรเจกต์ GCP ที่ถูกต้อง
- มีสิทธิ์ใช้ Cloud Run, Cloud Build, Secret Manager, Storage, IAM, Scheduler, IAP
- มีโดเมนจริงถ้าจะเปิด IAP/LB
- ถ้าใช้ SMTP จริง ต้องมีค่าที่ใช้งานได้

## โหมดที่รองรับ

### 1. โหมดทดสอบ

ใช้เมื่อ:

- ยังไม่มีโดเมนจริง
- ยังไม่เปิด IAP
- ต้องการทดสอบ backend บน Cloud Run ก่อน

ค่าหลัก:

```bash
export IAP_ENABLED="false"
export AUTO_CONFIGURE_IAP_LB="false"
```

ผลลัพธ์:

- Cloud Run หลัก deploy ด้วย ingress `all`
- backend ทดสอบผ่าน `run.app` ได้
- cleanup service ยังทำงานแยกของมันเองและยัง require auth

### 2. โหมด IAP จริง

ใช้เมื่อ:

- มีโดเมนจริง
- ต้องการให้ Google IAP เป็น outer access gate

ค่าหลัก:

```bash
export IAP_ENABLED="true"
export AUTO_CONFIGURE_IAP_LB="true"
export LB_DOMAIN_NAMES="api.pstpyst.com"
export LB_SSL_MODE="managed"
export IAP_ACCESS_MEMBERS="domain:chula.ac.th,domain:student.chula.ac.th"
export FRONTEND_URL="https://pstpyst.com"
```

ถ้าจำเป็นต้องทดสอบ local ชั่วคราว ให้เติมเพิ่มผ่าน:

```bash
export FRONTEND_EXTRA_URLS="http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500|http://localhost:5173|http://127.0.0.1:8088"
```

แนวทางนี้ช่วยให้ค่า production default ไม่กว้างเกินจำเป็น

ผลลัพธ์:

- Cloud Run หลัก deploy ด้วย ingress `internal-and-cloud-load-balancing`
- ใช้ `--no-allow-unauthenticated`
- ใช้ `--no-default-url`
- deploy พร้อม `NODE_ENV=production`
- deploy backend หลักด้วย service account แยก แทน default compute service account
- `deploy.sh` จะสร้าง/update LB + IAP + backend audience ให้เอง
- `deploy.sh` จะพยายาม provision IAP service identity และ grant `run.invoker` ให้ IAP service agent ให้อัตโนมัติ
- frontend ที่ต้องการให้ backend จบ IAP login แล้วค่อยกลับมาหน้าบ้าน ควรใช้ `GET /api/v1/iap/complete?return_to=<frontend-url>`
- หลัง frontend ถูก redirect กลับมา แนะนำให้เรียก `GET /api/v1/iap/me` ด้วย `credentials: 'include'` เพื่อเช็กสถานะ session และอ่าน email จาก backend อย่างปลอดภัย

## ขั้น deploy มาตรฐาน

```bash
cd /Users/pst./senior/backend
chmod +x deploy.sh
./deploy.sh
```

สคริปต์จะจัดการให้:

- ตรวจ/สร้าง bucket
- จัดการ secrets
- deploy cleanup service รายวัน
- deploy backend หลัก
- ถ้าเปิด IAP auto mode จะจัดการ LB/IAP ให้ต่อ

## Checklist ก่อน Deploy

- ยืนยัน `PROJECT_ID`, `SERVICE_NAME`, `REGION` ให้ถูก
- ยืนยัน `LB_DOMAIN_NAMES` เป็นโดเมนจริงที่แก้ DNS ได้
- ยืนยัน `IAP_ENABLED=true` ถ้าจะเปิด IAP จริง
- ยืนยัน `AUTO_CONFIGURE_IAP_LB=true` ถ้าจะให้สคริปต์สร้าง LB/IAP ให้
- ยืนยัน `IAP_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"`
- ยืนยัน `IAP_REQUIRE_HOSTED_DOMAIN=true`
- ยืนยัน `IAP_ACCESS_MEMBERS="domain:chula.ac.th,domain:student.chula.ac.th"` หรือค่าที่ต้องการจริง
- ยืนยันว่า production ไม่เปิด `FRONTEND_EXTRA_URLS` ค้างไว้โดยไม่จำเป็น
- ยืนยันค่า SMTP และ `TECH_SUPPORT_TARGET_EMAIL`
- ยืนยันสิทธิ์ GCP สำหรับ Cloud Run, Load Balancer, IAP, IAM, Secret Manager, Scheduler, Storage
- ถ้าต้องการให้สคริปต์ช่วยรอหลัง deploy ให้เปิด:
  - `WAIT_FOR_DNS_PROPAGATION=true`
  - `WAIT_FOR_MANAGED_CERTIFICATE=true`
  - `POST_DEPLOY_HEALTHCHECK_ENABLED=true`

## Example IAP Deploy

```bash
cd /Users/pst./senior/backend

export PROJECT_ID="seniorproject101"
export SERVICE_NAME="sci-request-system"
export REGION="asia-southeast3"

export IAP_ENABLED="true"
export AUTO_CONFIGURE_IAP_LB="true"
export IAP_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
export IAP_REQUIRE_HOSTED_DOMAIN="true"
export IAP_ACCESS_MEMBERS="domain:chula.ac.th,domain:student.chula.ac.th"

export LB_DOMAIN_NAMES="api.pstpyst.com"
export FRONTEND_URL="https://pstpyst.com"
# ถ้าจะทดสอบ local ค่อยเปิดบรรทัดนี้ชั่วคราว
# export FRONTEND_EXTRA_URLS="http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500|http://localhost:5173|http://127.0.0.1:8088"

export WAIT_FOR_DNS_PROPAGATION="true"
export WAIT_FOR_MANAGED_CERTIFICATE="true"
export POST_DEPLOY_HEALTHCHECK_ENABLED="true"

./deploy.sh
```

## Production Values Snapshot

ค่าปัจจุบันที่ใช้จริงสำหรับ production ณ ตอนนี้:

```bash
PROJECT_ID="seniorproject101"
SERVICE_NAME="sci-request-system"
REGION="asia-southeast3"

BUCKET_NAME="sci-request-files-prod"
BUCKET_LOCATION="asia-southeast3"
BUCKET_STORAGE_CLASS="STANDARD"

FRONTEND_URL="https://pstpyst.com"

TECH_SUPPORT_TARGET_EMAIL="piyaton56@gmail.com"
SMTP_HOST_VALUE="pstpyst.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER_VALUE="no-reply@pstpyst.com"
SMTP_FROM_EMAIL_VALUE="no-reply@pstpyst.com"
SMTP_FROM_NAME_VALUE="Sci Request Support"

IAP_ENABLED="true"
AUTO_CONFIGURE_IAP_LB="true"
IAP_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
IAP_REQUIRE_HOSTED_DOMAIN="true"
IAP_ACCESS_MEMBERS="domain:chula.ac.th,domain:student.chula.ac.th"

LB_DOMAIN_NAMES="api.pstpyst.com"
LB_SSL_MODE="managed"

WAIT_FOR_DNS_PROPAGATION="true"
WAIT_FOR_MANAGED_CERTIFICATE="true"
POST_DEPLOY_HEALTHCHECK_ENABLED="true"

ENABLE_DAILY_FILE_CLEANUP_FUNCTION="true"
APP_SERVICE_ACCOUNT_NAME="sci-request-system-sa"
CLEANUP_SERVICE_NAME="delete-file-cleanup"
CLEANUP_SERVICE_REGION="asia-southeast3"
CLEANUP_SERVICE_ACCOUNT_NAME="delete-file-cleanup-sa"
CLEANUP_SCHEDULER_JOB_NAME="delete-file-cleanup-daily"
CLEANUP_SCHEDULER_FALLBACK_LOCATION="asia-southeast1"
CLEANUP_SCHEDULE_CRON="0 3 * * *"
CLEANUP_TIME_ZONE="Asia/Bangkok"

AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH="false"
AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET="false"
ENABLE_BUCKET_LIFECYCLE_CLEANUP="false"
```

หมายเหตุ:

- `SMTP_PASS_VALUE` ไม่ได้ถูก hardcode ในไฟล์ ต้องมาจาก Secret Manager, env, หรือ prompt ตอนรัน
- `IAP_EXPECTED_AUDIENCE` และ `IAP_BACKEND_SERVICE_ID` จะถูกคำนวณและเติมกลับให้อัตโนมัติเมื่อ LB/IAP ถูกสร้างสำเร็จ
- `NODE_ENV=production` จะถูก set ให้โดย default เพื่อให้ cookie behavior ตรงกับ production
- Cloud Scheduler อาจ fallback ไป `asia-southeast1` หาก location หลักยังไม่รองรับในโปรเจกต์นี้
- `LB_SSL_MODE=managed` คือค่า default ถ้าไม่มี cert ขององค์กร
- ถ้าต้องใช้ cert/key ขององค์กร ให้ตั้ง `LB_SSL_MODE=custom` และเตรียม Secret Manager สำหรับ cert/key ก่อน deploy
- backend หลักจะใช้ service account แยกชื่อ default เป็น `${SERVICE_NAME}-sa@PROJECT_ID.iam.gserviceaccount.com`

## Post-Deploy Security Checks

หลัง deploy production จริง ควรเช็กอย่างน้อย:

- cert ของ `api.pstpyst.com` เป็น `ACTIVE`
- Cloud Run ingress เป็น `internal-and-cloud-load-balancing`
- Cloud Run ไม่มี default URL
- IAP backend service เปิดอยู่
- IAP service agent มี `roles/run.invoker` บน service หลัก
- runtime env มี `NODE_ENV=production`
- `FRONTEND_URL` เป็น production origin ที่ต้องการจริง
- ถ้าใช้ `Custom OAuth` ให้ยืนยันว่า client secret ถูกเก็บนอก repo

## SMTP Password

สคริปต์จะใช้ลำดับนี้:

1. `SMTP_PASS_VALUE` จาก env
2. secret `SMTP_PASS` จาก Secret Manager
3. ถ้ายังไม่มี จะถามผ่าน prompt แบบซ่อนรหัส

หมายเหตุ:

- ไม่มีการ hardcode password ในไฟล์แล้ว

## Custom TLS Certificate Checklist

ใช้เมื่อ:

- องค์กรหรือมหาวิทยาลัยต้องการใช้ cert/key ของตัวเองแทน Google-managed certificate

สิ่งที่ต้องเตรียมใน Secret Manager:

- secret สำหรับ certificate PEM
- secret สำหรับ private key PEM

ชื่อ default ที่ `deploy.sh` รองรับ:

- `LB_CUSTOM_SSL_CERT_PEM`
- `LB_CUSTOM_SSL_PRIVATE_KEY_PEM`

ค่าที่ต้องตั้ง:

```bash
export LB_SSL_MODE="custom"
export LB_SSL_CERT_NAME="sci-request-system-custom-cert"
export LB_CUSTOM_SSL_CERT_SECRET_NAME="LB_CUSTOM_SSL_CERT_PEM"
export LB_CUSTOM_SSL_PRIVATE_KEY_SECRET_NAME="LB_CUSTOM_SSL_PRIVATE_KEY_PEM"
```

สิ่งที่ควรเช็กก่อน deploy:

- cert และ private key เป็นคู่กันจริง
- cert อยู่ในรูป PEM
- private key อยู่ในรูป PEM
- secret ถูกสร้างใน project ที่ deploy จริง
- คนที่รัน deploy มีสิทธิ์อ่าน secret

สิ่งที่ควรรู้:

- ถ้าใช้ `LB_SSL_MODE=custom` สคริปต์จะไม่รอ managed certificate
- private key ของ cert ไม่ควรถูกเก็บใน repo หรือวางเป็นไฟล์ถาวรในเครื่อง
- ถ้าไม่ได้มี requirement จากองค์กรจริง ให้ใช้ `LB_SSL_MODE=managed` จะง่ายและปลอดภัยกว่าในเชิง operation

## Daily Cleanup

cleanup architecture ปัจจุบัน:

`Cloud Scheduler -> OIDC -> Cloud Run cleanup service`

ค่าหลัก:

- service default: `delete-file-cleanup`
- service account default: `delete-file-cleanup-sa@PROJECT_ID.iam.gserviceaccount.com`
- schedule default: `0 3 * * *`
- timezone default: `Asia/Bangkok`

สิ่งที่ cleanup ทำ:

- ลบ object ทั้งหมดใน bucket ไฟล์
- ลบ Firestore records ใต้ `SESSION/*/files`

สิ่งที่ควรรู้:

- cleanup service ใช้ service account แยก
- scheduler จะใช้ OIDC caller
- ถ้า scheduler location หลักใช้ไม่ได้ จะ fallback ไป `asia-southeast1`
- ถ้ามี Cloud Function/scheduler cleanup แบบเก่าค้างอยู่ สคริปต์จะลบให้อัตโนมัติหลัง path ใหม่พร้อม

## App Service Account

เพื่อไม่ให้ backend หลักแชร์สิทธิ์กว้างกับ default compute service account อีกต่อไป `deploy.sh` จะสร้าง service account แยกสำหรับแอปหลักโดย default:

- `${SERVICE_NAME}-sa@PROJECT_ID.iam.gserviceaccount.com`

สิทธิ์หลักที่สคริปต์ให้:

- `roles/secretmanager.secretAccessor` ระดับโปรเจกต์
- `roles/aiplatform.user` ระดับโปรเจกต์
- `roles/datastore.user` ระดับโปรเจกต์
- `roles/storage.objectAdmin` แบบผูกเฉพาะ bucket เป้าหมาย

ผลลัพธ์:

- ลด blast radius จากการใช้ default compute service account
- จำกัดสิทธิ์ storage เหลือเฉพาะ bucket ที่ระบบใช้จริง
- ในโหมด IAP จะปิด default `run.app` URL ด้วย `--no-default-url` เพื่อลดช่อง bypass LB/IAP

## Bucket Migration

ค่า default ปลอดภัย:

- `AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH=false`
- `AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET=false`

ความหมาย:

- deploy ปกติจะไม่เริ่ม bucket migration เอง
- จะไม่ไปลบ temp bucket migration เอง เว้นแต่เปิด explicit

ถ้าต้อง migrate bucket จริง:

- ใช้ env migration โดยตั้งเองชัดเจน
- อ่าน warning เรื่อง downtime ให้ครบก่อนรัน

## Checklist หลัง Deploy

เช็กอย่างน้อย:

- backend หลัก deploy สำเร็จ
- cleanup service deploy สำเร็จ
- scheduler job เป็น `ENABLED`
- เอา IP ที่สคริปต์พิมพ์ออกมาไปชี้ `A record`
- DNS resolve มาที่ IP ของ LB แล้ว
- managed certificate เป็น `ACTIVE`
- `IAP_EXPECTED_AUDIENCE` ถูกเติมกลับเข้า Cloud Run แล้ว
- ถ้าเป็นโหมด IAP จริง:
  - LB/IAP พร้อม
  - ผู้ใช้ที่ไม่มีสิทธิ์เข้าไม่ได้

## Test Checklist

- เปิดโดเมนจริงแล้วต้องเด้งไป Google login
- login ด้วย `@chula.ac.th` ได้
- login ด้วย `@student.chula.ac.th` ได้
- login ด้วย Gmail ส่วนตัวไม่ได้
- ผู้ใช้ที่ผ่าน IAP แต่ไม่มี session เดิมของระบบ ยังเข้า API ที่ต้อง auth ไม่ได้
- `/api/v1/auth/public-key` ยังตอบได้ใน flow ที่ควรตอบ
- flow หลักของระบบยังใช้งานได้
- support upload/merge/validation ยังใช้งานได้
- cleanup job ยังเป็น `ENABLED`

## Security Checklist

- Cloud Run หลักอยู่หลัง IAP จริง
- โหมด IAP ใช้ `--no-allow-unauthenticated`
- โหมด IAP ใช้ `--no-default-url`
- ingress ของ service หลักเป็น `internal-and-cloud-load-balancing`
- backend หลักใช้ service account แยก ไม่ใช้ default compute service account
- backend ยัง verify IAP JWT
- backend ยังเช็ก domain `chula.ac.th,student.chula.ac.th`
- session auth เดิมยังทำงาน
- ไม่ได้ลด CORS/origin/rate-limit/file validation เดิม

## ถ้า deploy ล้ม

ให้ดูตามหมวด:

- Bucket / IAM / Secret Manager
- Cleanup service / Scheduler
- Cloud Run main service
- IAP / LB / DNS / certificate

เช็กสาเหตุพื้นฐานก่อน:

- DNS ยังไม่ชี้
- cert ยังไม่ `ACTIVE`
- `LB_DOMAIN_NAMES` ผิด
- `IAP_ACCESS_MEMBERS` ผิด
- account ที่ใช้ login ไม่ได้อยู่ใน Google Workspace domain ที่ตรงตาม policy
- project/region ใน env ไม่ตรงของจริง

และส่ง log ล่าสุดของ `deploy.sh` มาทั้งบล็อกที่ fail

## เอกสารที่เกี่ยวข้อง

- [IAP_DEPLOYMENT_GUIDE.md](/Users/pst./senior/backend/IAP_DEPLOYMENT_GUIDE.md)
- [KEY_ROTATION.md](/Users/pst./senior/backend/KEY_ROTATION.md)
- [API_DOCUMENTATION.md](/Users/pst./senior/backend/API_DOCUMENTATION.md)
