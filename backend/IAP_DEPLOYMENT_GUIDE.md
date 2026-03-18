# Google Cloud IAP Deployment Guide

เอกสารนี้ออกแบบมาสำหรับกรณีที่ต้องการ "บังคับให้ผู้ใช้ล็อกอินด้วย Google Account ของ Chula ก่อนใช้งานระบบ" โดยไม่ลด security layer เดิมของ backend

## Target Architecture

แนะนำสถาปัตยกรรมดังนี้:

`User Browser -> External HTTPS Load Balancer -> IAP -> Serverless NEG -> Cloud Run -> Express app`

หลักการสำคัญ:

- IAP เป็น outer access gate บังคับ sign-in ก่อนถึง backend
- backend ยัง verify session cookie/JWT เดิมต่อเหมือนเดิม
- backend verify `x-goog-iap-jwt-assertion` ทุก request ที่เข้ามาหลัง IAP
- Cloud Run จำกัด ingress เป็น `internal-and-cloud-load-balancing`
- อย่าปล่อยให้ `run.app` direct traffic กลายเป็นทาง bypass

## Recommended Access Model

ตัวเลือกที่ปลอดภัยที่สุด:

1. สร้าง Google Group สำหรับผู้มีสิทธิ์ใช้งานจริง เช่น `sci-request-users@chula.ac.th`
2. ให้สิทธิ์ IAP access กับ group นี้
3. ใช้ `IAP_ALLOWED_DOMAINS=chula.ac.th,student.chula.ac.th` เป็นชั้นตรวจซ้ำใน backend

หมายเหตุ:

- ถ้าให้สิทธิ์ทั้ง domain `chula.ac.th` ผู้ใช้ทุกคนในโดเมนอาจเข้าถึงได้
- ถ้าต้องการจำกัดเฉพาะนิสิต/บุคลากรบางกลุ่ม ให้ใช้ Google Group ที่ดูแลโดย Chula
- backend ใน repo นี้ตรวจได้ถึง domain/hosted domain จาก assertion เท่านั้น ไม่สามารถแทน group-based authorization ของ IAP ได้

## Backend Changes In This Repo

โค้ดใน repo นี้รองรับ IAP แล้วดังนี้:

- เพิ่ม [iapMiddleware.js](/Users/pst./senior/backend/middlewares/iapMiddleware.js) เพื่อ verify signed JWT จาก IAP
- validate `issuer`, `audience`, `alg`, `kid`
- ตรวจ email domain จาก `IAP_ALLOWED_DOMAINS`
- optional check `hd` ผ่าน `IAP_REQUIRE_HOSTED_DOMAIN=true`
- แนบข้อมูล IAP identity เข้า `req.iap`
- คง [authMiddleware.js](/Users/pst./senior/backend/middlewares/authMiddleware.js) เดิมไว้เป็น inner auth layer

ผลลัพธ์คือ request จะต้องผ่าน:

1. IAP
2. IAP JWT verification ใน backend
3. session cookie/JWT ของระบบเดิม
4. encryption/origin/rate limit/file validation ตามของเดิม

## Required Runtime Environment

ตัวแปรใหม่ที่ backend ใช้:

- `IAP_ENABLED=true`
- `IAP_ALLOWED_DOMAINS=chula.ac.th,student.chula.ac.th`
- `IAP_REQUIRE_HOSTED_DOMAIN=true`
- `IAP_EXPECTED_AUDIENCE=` optional override
- `IAP_BACKEND_SERVICE_ID=` ใช้เมื่อ IAP อยู่ที่ load balancer backend service
- `GCP_PROJECT_NUMBER`
- `APP_REGION`

การหา expected audience:

- ถ้าใช้ IAP แบบ Cloud Run audience:
  `/projects/PROJECT_NUMBER/locations/REGION/services/SERVICE_NAME`
- ถ้าใช้ IAP หน้า load balancer backend service:
  `/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`

ถ้าคุณใช้ load balancer mode ให้ตั้ง `IAP_EXPECTED_AUDIENCE` ตรง ๆ จะชัดที่สุด

## Google Cloud Setup Checklist

ถ้าทีม ops ต้องการ runbook แบบสั้นสำหรับ deploy จริง ให้ดูเพิ่มที่ [DEPLOY_RUNBOOK.md](/Users/pst./senior/backend/DEPLOY_RUNBOOK.md)

### 1. เตรียม Cloud Run

- Deploy service นี้ด้วย ingress เป็น `internal-and-cloud-load-balancing`
- ให้ service account ของ Cloud Run มีสิทธิ์เท่าที่ระบบต้องใช้จริงเท่านั้น
- ตรวจว่าระบบยังทำงานได้ปกติโดยไม่ปิด auth layer เดิม

สคริปต์ [deploy.sh](/Users/pst./senior/backend/deploy.sh) รองรับทั้ง env สำหรับ IAP และโหมด auto-configure load balancer/IAP

หมายเหตุเกี่ยวกับ `deploy.sh` เวอร์ชันปัจจุบัน:

- ถ้า `IAP_ENABLED=false` และ `AUTO_CONFIGURE_IAP_LB=false` สคริปต์จะ deploy Cloud Run ด้วย ingress `all` สำหรับโหมดทดสอบ
- ถ้า `IAP_ENABLED=true` หรือ `AUTO_CONFIGURE_IAP_LB=true` สคริปต์จะบังคับ ingress เป็น `internal-and-cloud-load-balancing`
- ในโหมด IAP จริง สคริปต์จะใช้ `--no-allow-unauthenticated` เพื่อไม่ให้ลด security จากเดิม
- ในโหมด IAP จริง สคริปต์จะใช้ `--no-default-url` เพื่อลดโอกาส bypass ผ่าน `run.app`
- backend หลักจะใช้ service account แยกจาก default compute service account โดยอัตโนมัติ
- SMTP password จะไม่ถูก hardcode ในไฟล์แล้ว แต่จะมาจาก env, Secret Manager, หรือ prompt แบบซ่อนรหัส

### 1.1 Daily Cleanup Architecture

รอบปัจจุบัน `deploy.sh` ไม่ได้ใช้ Cloud Function เป็น cleanup worker หลักแล้ว แต่ใช้:

`Cloud Scheduler -> OIDC -> Private Cloud Run cleanup service`

หลักการ:

- cleanup worker หลักชื่อ default คือ `delete-file-cleanup`
- deploy เป็น Cloud Run service ใน region เดียวกับแอปหลักเท่าที่รองรับ
- service นี้ `require auth`
- Cloud Scheduler จะเรียกด้วย OIDC token
- ถ้า location ของ Cloud Scheduler ใช้ region เดียวกับแอปไม่ได้ สคริปต์จะ fallback ไป `asia-southeast1`

สิ่งที่ cleanup worker ทำ:

- ลบ object ทั้งหมดใน bucket ที่ระบบใช้เก็บไฟล์
- ลบ metadata ใน Firestore ที่อยู่ใต้ `SESSION/*/files`

สิ่งที่ยังไม่ลบ:

- session document หลัก
- chat history หรือข้อมูลอื่นนอก `files` subcollection

### 1.2 Cleanup Service Account

สคริปต์จะสร้าง service account แยกสำหรับ cleanup โดย default:

- `delete-file-cleanup-sa@PROJECT_ID.iam.gserviceaccount.com`

และให้สิทธิ์ขั้นต่ำเท่าที่งาน cleanup ต้องใช้:

- `roles/storage.objectAdmin` แบบผูกที่ bucket เป้าหมาย
- `roles/datastore.user` ที่ระดับ project สำหรับลบ Firestore records ที่เกี่ยวข้อง

โดย default scheduler จะใช้ cleanup service account เดียวกันเป็น OIDC caller ด้วย เว้นแต่จะ override ผ่าน `CLEANUP_INVOKER_SERVICE_ACCOUNT`

เหตุผลของการแยก account:

- ลด blast radius เมื่อเทียบกับการใช้ default compute service account ของแอปหลัก
- ไม่ทำให้ cleanup service ได้สิทธิ์ลับหรือสิทธิ์ AI/Secret Manager เกินจำเป็น

### 1.2.1 App Service Account

เพื่อให้แอปหลักไม่ใช้ default compute service account อีกต่อไป `deploy.sh` จะสร้าง service account แยกโดย default:

- `${SERVICE_NAME}-sa@PROJECT_ID.iam.gserviceaccount.com`

สิทธิ์ที่สคริปต์ตั้งให้อัตโนมัติ:

- `roles/secretmanager.secretAccessor` ระดับโปรเจกต์
- `roles/aiplatform.user` ระดับโปรเจกต์
- `roles/datastore.user` ระดับโปรเจกต์
- `roles/storage.objectAdmin` แบบผูกเฉพาะ bucket ของระบบ

ผลคือ:

- ลด blast radius ถ้า service หลักถูกใช้งานผิดบริบท
- ไม่ต้องให้ storage privilege ระดับทั้งโปรเจกต์กับแอปหลักอีก
- ทำให้ IAP mode แข็งขึ้นเมื่อจับคู่กับ `--no-default-url`

### 1.3 Legacy Cleanup Resource Retirement

หลัง cleanup service ใหม่และ scheduler ใหม่พร้อมแล้ว สคริปต์จะพยายามลบ resource เก่าที่ไม่ใช้แล้วให้อัตโนมัติ เช่น:

- Cloud Function `delete-file`
- Cloud Function `delete-file-fn`
- Scheduler job `delete-file-daily`
- Scheduler job `delete-file-fn-daily`

เป้าหมายคือ:

- ลด attack surface
- ไม่ให้มี cleanup path หลายชุดค้างอยู่ในระบบ
- ลดความสับสนของทีม ops เวลา audit resource

### เปิด IAP แบบละเอียด

ลำดับที่แนะนำสำหรับโปรเจกต์นี้:

1. Deploy backend แบบทดสอบก่อน
   ตั้ง `IAP_ENABLED=false` และ `AUTO_CONFIGURE_IAP_LB=false`
   ในโหมดนี้ `deploy.sh` จะปรับ Cloud Run ingress เป็น `all` อัตโนมัติ เพื่อให้ทดสอบ service ตรงได้

2. ยืนยันว่า backend ทำงานปกติบน Cloud Run
   ทดสอบ endpoint เช่น `/healthz`, `/api/v1/auth/public-key`, และ flow หลักของระบบ

3. เตรียมโดเมนจริงที่จะวางหน้า Load Balancer
   สำหรับโปรเจกต์นี้ production backend ใช้ `api.pstpyst.com`
   โดเมนนี้ต้องเป็นโดเมนที่คุณควบคุม DNS ได้

4. กำหนด principal ที่จะอนุญาตผ่าน IAP
   สำหรับเคสปัจจุบันของโปรเจกต์นี้ ใช้ได้ตรง ๆ เป็น
   `domain:chula.ac.th,domain:student.chula.ac.th`
   ถ้าวันไหนต้องการแคบลงค่อยเปลี่ยนไปใช้ Google Group

5. เปิดโหมด IAP/LB ใน `deploy.sh`
   ตั้ง:
   - `IAP_ENABLED=true`
   - `AUTO_CONFIGURE_IAP_LB=true`
   - `LB_DOMAIN_NAMES=<โดเมนจริง>`
   - `IAP_ACCESS_MEMBERS=domain:chula.ac.th,domain:student.chula.ac.th`

6. รัน `deploy.sh`
   สคริปต์จะ:
   - deploy Cloud Run ใหม่ด้วย ingress เป็น `internal-and-cloud-load-balancing`
   - สร้าง global IP
   - สร้าง certificate สำหรับ LB ตามโหมดที่ตั้ง (`managed` หรือ `custom`)
   - สร้าง serverless NEG
   - สร้าง backend service
   - สร้าง URL map / HTTPS proxy / forwarding rule
   - เปิด IAP บน backend service
   - เพิ่ม IAM binding ให้ IAP
   - คำนวณ `IAP_EXPECTED_AUDIENCE` และอัปเดตกลับเข้า Cloud Run

7. เอา DNS ที่สคริปต์พิมพ์ออกมาไปชี้ใน zone จริง
   ตัวอย่าง:
   `api.pstpyst.com -> 34.x.x.x`

8. รอ DNS propagation และ certificate provisioning
   ถ้าตั้ง `WAIT_FOR_DNS_PROPAGATION=true` และ `WAIT_FOR_MANAGED_CERTIFICATE=true`
   สคริปต์จะช่วย poll ให้

9. ทดสอบหน้าใช้งานจริงผ่านโดเมน LB
   สิ่งที่ควรเห็น:
   - ผู้ใช้ถูกพาไป login Google
   - ผู้ใช้ที่ไม่อยู่ในสิทธิ์ IAP เข้าไม่ได้
   - ผู้ใช้ที่ผ่าน IAP แล้วแต่ไม่มี session เดิมของระบบ ยังถูก backend ปฏิเสธ

10. ถ้าฝั่ง frontend ต้องการเปิดหน้าแล้วพาไป login ทันที
   ให้ redirect ผู้ใช้ไป:
   `GET /api/v1/iap/complete?return_to=<frontend-url>`
   route นี้จะอยู่หลัง IAP, ให้ backend สร้าง session cookie ก่อน แล้วค่อย redirect กลับเฉพาะ URL ที่อยู่ใน allowlist ของ `FRONTEND_URL`
   หลัง frontend ถูก redirect กลับมา ให้เรียก `GET /api/v1/iap/me` เพื่ออ่าน email/hosted domain จาก backend แทนการส่งข้อมูลผ่าน query string

11. ตรวจ defense-in-depth ของ backend
   backend จะยังตรวจ:
   - signed IAP assertion
   - allowed domains `chula.ac.th,student.chula.ac.th`
   - session cookie/JWT เดิม
   - encryption/rate limit/origin/file validation เดิม

12. ยืนยันว่าไม่มี direct bypass
   ในโหมด IAP จริง Cloud Run จะถูก deploy ด้วย ingress `internal-and-cloud-load-balancing`
   และปิด default `run.app` URL ด้วย `--no-default-url`
   จึงควรเข้าผ่าน LB domain เป็นหลัก ไม่ใช่ทดสอบผ่าน `run.app`

ตอนนี้ถ้าตั้ง `AUTO_CONFIGURE_IAP_LB=true` สคริปต์จะสร้างให้อัตโนมัติได้ถึง:

- global IP address
- managed SSL certificate หรือ custom SSL certificate จาก Secret Manager
- serverless NEG
- backend service
- URL map
- HTTPS proxy
- forwarding rule
- เปิด IAP บน backend service
- เติม `IAP_EXPECTED_AUDIENCE` กลับเข้า Cloud Run ให้อัตโนมัติ
- พิมพ์ DNS record ที่ต้องชี้
- poll รอ DNS propagation ได้อัตโนมัติ
- poll รอสถานะ managed certificate ได้อัตโนมัติ
- ยิง HTTPS healthcheck หลัง deploy ได้อัตโนมัติ
- deploy/update cleanup service รายวันและ scheduler ให้อัตโนมัติ
- สร้าง cleanup service account แบบแยกสิทธิ์ให้อัตโนมัติ
- cleanup legacy cleanup resources เก่าให้อัตโนมัติเมื่อ path ใหม่พร้อมแล้ว

สิ่งที่ยังต้องทำเอง:

- ชี้ DNS ของโดเมนจริงไปที่ global IP ที่สคริปต์สร้าง
- ถ้าใช้ `LB_SSL_MODE=managed` ให้รอ managed certificate เปลี่ยนเป็น `ACTIVE`
- เตรียม OAuth client ID/secret สำหรับ IAP
- ระบุ principal ที่ต้องอนุญาตผ่าน `IAP_ACCESS_MEMBERS`

### TLS Certificate Mode

ตอนนี้ `deploy.sh` รองรับ 2 โหมด:

- `LB_SSL_MODE=managed`
  - ใช้ Google-managed certificate
  - เป็น default
  - สคริปต์จะสร้าง cert จาก `LB_DOMAIN_NAMES` ให้เอง

- `LB_SSL_MODE=custom`
  - ใช้ certificate/private key ขององค์กร เช่นกรณีมหาวิทยาลัยมี cert ของตัวเอง
  - สคริปต์จะอ่านค่าจาก Secret Manager แล้วสร้าง Google Cloud SSL certificate resource ให้

เมื่อใช้ `custom` ต้องมี secret อย่างน้อย:

- `LB_CUSTOM_SSL_CERT_SECRET_NAME`
- `LB_CUSTOM_SSL_PRIVATE_KEY_SECRET_NAME`

ค่า default ของชื่อ secret คือ:

- `LB_CUSTOM_SSL_CERT_SECRET_NAME=LB_CUSTOM_SSL_CERT_PEM`
- `LB_CUSTOM_SSL_PRIVATE_KEY_SECRET_NAME=LB_CUSTOM_SSL_PRIVATE_KEY_PEM`

ข้อสำคัญ:

- ถ้าไม่ได้ตั้ง `LB_SSL_MODE=custom` ระบบจะยังใช้ Google-managed certificate เหมือนเดิม
- อย่าเก็บ private key ของ cert ไว้ใน repo
- ถ้าใช้ `custom` สคริปต์จะไม่รอ `managed certificate` เพราะ cert ถูกจัดการเอง

ถ้าไม่ส่ง `IAP_OAUTH_CLIENT_ID` และ `IAP_OAUTH_CLIENT_SECRET`:

- `deploy.sh` จะพยายามเปิด IAP แบบใช้ Google-managed OAuth client อัตโนมัติ
- ควรใช้แนวทางนี้เป็นค่า default สำหรับโปรเจกต์ใหม่
- เหตุผลคือคำสั่ง `gcloud iap oauth-brands` และ `gcloud iap oauth-clients` ถูกประกาศ deprecated แล้ว โดย `Jan 19, 2026` โปรเจกต์ใหม่ใช้ไม่ได้ และ `Mar 19, 2026` จะถูกปิดถาวร

### 2. สร้าง Serverless NEG และ HTTPS Load Balancer

- สร้าง serverless NEG ชี้ไปที่ Cloud Run service
- สร้าง external HTTPS load balancer
- ผูก backend service กับ serverless NEG
- ผูก TLS certificate และ custom domain

คำแนะนำเชิงสถาปัตยกรรม:

- ถ้า frontend จริงเป็นเว็บที่ผู้ใช้เปิดใช้งานโดยตรง ควรอยู่หลัง load balancer/IAP ชุดเดียวกันหรืออย่างน้อยอยู่ภายใต้ origin ที่ควบคุมได้
- ถ้า frontend เรียก API ข้ามโดเมน IAP จะสร้าง UX และ auth flow ที่ซับซ้อนขึ้นมาก

### 3. เปิด IAP

- เปิด IAP บน backend service ที่อยู่หลัง load balancer
- เพิ่ม principal ที่อนุญาตใช้งาน

แนะนำสำหรับ deployment ปัจจุบัน:

- ใช้ `domain:chula.ac.th,domain:student.chula.ac.th`
- ถ้าวันหนึ่งต้องการจำกัดให้แคบลงค่อยเปลี่ยนไปใช้ Google Group

### 4. ตั้งสิทธิ์ IAP

- ให้ role `roles/iap.httpsResourceAccessor` กับ group หรือ domain ที่ต้องการ
- จำกัด admin rights ให้เฉพาะผู้ดูแลระบบ

### 5. เก็บ Expected Audience ลง Runtime

- หา backend service ID
- ตั้ง `IAP_EXPECTED_AUDIENCE=/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`

หรือถ้าใช้ direct Cloud Run IAP mode:

- ตรวจให้ runtime มี `GCP_PROJECT_NUMBER`, `APP_REGION`, และ service name ถูกต้อง

### 6. ป้องกันทาง bypass

ต้องตรวจทุกข้อ:

- Cloud Run ingress เป็น `internal-and-cloud-load-balancing`
- ไม่เปิด endpoint อื่นที่วิ่งเข้า service โดยตรงจาก internet
- อย่าเชื่อ `x-goog-authenticated-user-email` โดยไม่ verify signed assertion
- อย่าปิด session/JWT เดิมของระบบ
- อย่าลด CORS/origin/file validation/rate limit ของเดิม

### 7. ทดสอบก่อน production

ทดสอบอย่างน้อย:

- ผู้ใช้ `@chula.ac.th` เข้าได้
- ผู้ใช้ Google account ส่วนตัวเข้าไม่ได้
- ผู้ใช้ `@student.chula.ac.th` เข้าได้
- request ที่ไม่มี `x-goog-iap-jwt-assertion` ถูก block
- request ที่ signed JWT audience ไม่ตรงถูก block
- request ที่มี session เดิมแต่ไม่ผ่าน IAP ถูก block
- request ที่ผ่าน IAP แต่ไม่มี session cookie เดิม ยังถูก block

## Deploy Flow

ลำดับ rollout ที่แนะนำ:

1. deploy code เวอร์ชันนี้โดย `IAP_ENABLED=false`
2. สร้าง load balancer + IAP ให้ครบ
3. ตั้ง `IAP_EXPECTED_AUDIENCE` และ `IAP_ALLOWED_DOMAINS`
4. deploy ใหม่ด้วย `IAP_ENABLED=true`
5. ทดสอบผ่าน load balancer domain เท่านั้น
6. ตรวจว่าทางเข้าตรง Cloud Run ใช้งานไม่ได้จาก internet

### โหมดทดสอบ vs โหมด IAP จริง

โหมดทดสอบ:

- `IAP_ENABLED=false`
- `AUTO_CONFIGURE_IAP_LB=false`
- `deploy.sh` จะตั้ง Cloud Run ingress เป็น `all`
- ใช้สำหรับทดสอบ backend ก่อนมีโดเมนจริง
- cleanup service ยังสามารถทำงานได้โดยไม่กระทบ auth ของ API หลัก เพราะเป็นคนละ service และยังบังคับ auth ที่ตัวมันเอง

โหมด IAP จริง:

- `IAP_ENABLED=true`
- `AUTO_CONFIGURE_IAP_LB=true`
- `deploy.sh` จะตั้ง Cloud Run ingress เป็น `internal-and-cloud-load-balancing`
- ใช้เมื่อมีโดเมนจริงและพร้อมให้ LB/IAP เป็นด่านหน้า
- ในโหมดนี้ Cloud Run หลักจะใช้ `--no-allow-unauthenticated`

## Deploy Script Operational Notes

พฤติกรรมสำคัญของ `deploy.sh` เวอร์ชันปัจจุบัน:

- `AUTO_CREATE_BUCKET_ON_LOCATION_MISMATCH=false` เป็นค่า default เพื่อไม่ให้ migration bucket แบบทำลายข้อมูลเริ่มเองโดยไม่ตั้งใจ
- `AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET=false` เป็นค่า default เพื่อไม่ให้สคริปต์ไปลบ temp bucket โดยอาศัยการเดาจากชื่อ bucket เอง
- ถ้าต้อง migrate bucket แบบ strict same-name จริง ต้องเปิดเองอย่าง explicit
- ถ้า bucket migration ค้างและคุณต้องการให้สคริปต์เก็บกวาด temp bucket ให้อัตโนมัติ ต้องเปิด `AUTO_CLEANUP_LEFTOVER_TEMP_BUCKET=true` เอง
- cleanup service จะพยายามใช้ region เดียวกับแอปก่อน แต่ scheduler อาจ fallback ไปคนละ region ได้หาก location นั้นไม่รองรับในโปรเจกต์
- behavior นี้ไม่ลด security เพราะ scheduler ยังเรียกผ่าน OIDC ไปยัง cleanup service ที่ require auth อยู่เสมอ

## Example Deploy Command

ตัวอย่าง env ก่อนรัน [deploy.sh](/Users/pst./senior/backend/deploy.sh):

```bash
export PROJECT_ID="seniorproject101"
export SERVICE_NAME="sci-request-system"
export REGION="asia-southeast3"
export CLOUD_RUN_INGRESS="internal-and-cloud-load-balancing"
export IAP_ENABLED="true"
export IAP_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
export IAP_REQUIRE_HOSTED_DOMAIN="true"
export AUTO_CONFIGURE_IAP_LB="true"
export LB_DOMAIN_NAMES="api.pstpyst.com"
export LB_SSL_MODE="managed"
export IAP_ACCESS_MEMBERS="domain:chula.ac.th,domain:student.chula.ac.th"
export FRONTEND_URL="https://pstpyst.com"
export WAIT_FOR_DNS_PROPAGATION="true"
export WAIT_FOR_MANAGED_CERTIFICATE="true"
export POST_DEPLOY_HEALTHCHECK_ENABLED="true"

cd /Users/pst./senior/backend
./deploy.sh
```

ถ้าจะใช้ custom certificate ขององค์กร:

```bash
export LB_SSL_MODE="custom"
export LB_SSL_CERT_NAME="sci-request-system-custom-cert"
export LB_CUSTOM_SSL_CERT_SECRET_NAME="LB_CUSTOM_SSL_CERT_PEM"
export LB_CUSTOM_SSL_PRIVATE_KEY_SECRET_NAME="LB_CUSTOM_SSL_PRIVATE_KEY_PEM"
```

## Operational Notes

- ถ้า Chula ใช้ Google Workspace จริง การบังคับ `@chula.ac.th` และ `@student.chula.ac.th` ผ่าน IAP ทำได้ตรงไปตรงมา
- ถ้า identity จริงของ Chula อยู่บน SSO ภายนอกหรือ third-party federation ต้องยืนยันก่อนว่า IAP จะเห็น identity เป็นรูปแบบใด
- ถ้าต้องการ authorization ระดับละเอียดกว่าทั้งโดเมน ให้ใช้ Google Group ที่ IAP/IAM เป็นตัวบังคับ และปล่อยให้ backend ทำ domain verification เป็น defense in depth

## Key Rotation Runbook

ระบบ encryption ของ repo นี้ใช้ app-level RSA key pair สำหรับ hybrid encryption ระหว่าง frontend กับ backend

ถ้าทีม ops ต้องการ runbook แบบสั้นสำหรับใช้งานจริง ให้ดูเพิ่มที่ [KEY_ROTATION.md](/Users/pst./senior/backend/KEY_ROTATION.md)

หมายเหตุสำคัญ:

- key/certificate ชุดนี้เป็นคนละเรื่องกับ TLS certificate ของ load balancer หรือ `run.app`
- ถ้าเปลี่ยนแค่ HTTPS cert ของโดเมน ไม่ได้แปลว่าต้องเปลี่ยน key pair สำหรับ `/api/v1/auth/public-key`
- ถ้าจะเปลี่ยน key/certificate ที่ frontend ใช้เข้ารหัส payload ให้ backend ต้องมี private key คู่กันเสมอ

ปัจจุบัน runtime รองรับ secret เหล่านี้:

- `Gb_PRIVATE_KEY_BASE64`
- `Gb_PUBLIC_KEY_BASE64`
- `Gb_PREVIOUS_PRIVATE_KEY_BASE64` optional
- `Gb_PREVIOUS_PUBLIC_KEY_BASE64` optional

โดย `Gb_PUBLIC_KEY_BASE64` และ `Gb_PREVIOUS_PUBLIC_KEY_BASE64` ใส่ได้ทั้ง:

- public key PEM (`BEGIN PUBLIC KEY`)
- certificate PEM (`BEGIN CERTIFICATE`)

backend จะ:

- extract public key จาก certificate ให้อัตโนมัติ
- ตรวจว่า public/private key เป็นคู่กันจริงตอน startup
- ตรวจ certificate expiry ของ active slot
- decrypt ด้วย active private key ก่อน แล้ว fallback ไป previous private key ได้ในช่วง rotate

### กรณี 1: ต่ออายุ certificate จาก key เดิม

ใช้กรณีที่ CA ออก certificate ใบใหม่ให้ แต่ยังใช้ private key เดิม

ลำดับที่แนะนำ:

1. เอา certificate ใหม่ไปแทนค่าใน `Gb_PUBLIC_KEY_BASE64`
2. คง `Gb_PRIVATE_KEY_BASE64` เดิมไว้
3. deploy ใหม่
4. ตรวจ log ตอน startup ว่าโหลด certificate ใหม่ได้และ `Active Certificate Valid To` ถูกต้อง

กรณีนี้ไม่จำเป็นต้องใช้ previous key slot ถ้า private key เดิมยังเหมือนเดิม

### กรณี 2: เปลี่ยนไปใช้ key pair ใหม่

ใช้กรณีที่ CA ออก certificate ใหม่พร้อม key pair ใหม่ หรือทีม security ต้องการ rotate key แบบเต็มชุด

ลำดับที่แนะนำ:

1. เก็บคู่ปัจจุบันไว้ก่อน
   - copy ค่าเดิมของ `Gb_PRIVATE_KEY_BASE64`
   - copy ค่าเดิมของ `Gb_PUBLIC_KEY_BASE64`

2. อัปเดต active slot เป็นคู่ใหม่
   - `Gb_PRIVATE_KEY_BASE64` = private key ใหม่
   - `Gb_PUBLIC_KEY_BASE64` = certificate ใหม่ หรือ public key ใหม่

3. ย้ายคู่เก่าไป previous slot
   - `Gb_PREVIOUS_PRIVATE_KEY_BASE64` = private key เก่า
   - `Gb_PREVIOUS_PUBLIC_KEY_BASE64` = certificate/public key เก่า

4. deploy ใหม่
   - request ใหม่จะถูกเข้ารหัสด้วย public key ใหม่จาก `/api/v1/auth/public-key`
   - request เก่าที่เข้ารหัสด้วย key เดิมยัง decrypt ได้ผ่าน previous private key

5. รอช่วง transition
   - รอให้ frontend/client ที่ cache public key เก่าหมดรอบ
   - ถ้ามี session/request อายุสั้น ช่วงนี้มักใช้เวลาไม่นาน

6. ลบ previous slot เมื่อมั่นใจแล้ว
   - ลบ `Gb_PREVIOUS_PRIVATE_KEY_BASE64`
   - ลบ `Gb_PREVIOUS_PUBLIC_KEY_BASE64`
   - deploy อีกรอบ

### Deploy Integration

`deploy.sh` จะผูก previous key secrets ให้อัตโนมัติถ้ามี secret เหล่านี้อยู่แล้ว:

- `Gb_PREVIOUS_PRIVATE_KEY_BASE64`
- `Gb_PREVIOUS_PUBLIC_KEY_BASE64`

ดังนั้นช่วง rotate ให้:

1. update secret active pair
2. create/update secret previous pair
3. รัน [deploy.sh](/Users/pst./senior/backend/deploy.sh)

### สิ่งที่ห้ามทำ

- ห้ามเอา certificate ใหม่มาแทน public key โดยที่ private key ไม่ใช่คู่กัน
- ห้ามลบ key เก่าทันทีถ้ายังมีโอกาสที่ client จะใช้ public key เดิมอยู่
- ห้ามสับสนระหว่าง TLS cert ของ LB/IAP กับ app-level encryption key ของระบบนี้

### วิธีตรวจหลัง rotate

ตรวจอย่างน้อย:

- `GET /api/v1/auth/public-key` คืน public key ของ active slot ใหม่
- startup log แสดง `Active Key Slot: current`
- ถ้ามี previous slot จะเห็น `Key Rotation Fallback: ENABLED`
- ถ้าใช้ certificate PEM จะเห็น `Active Certificate Valid To: ...`
- flow `session/init`, `validation`, `documents/merge` ยังใช้งานได้จริง

## References

- IAP signed headers: https://cloud.google.com/iap/docs/signed-headers-howto
- IAP identity headers: https://cloud.google.com/iap/docs/identity-howto
- Enabling IAP for Cloud Run: https://docs.cloud.google.com/iap/docs/enabling-cloud-run
- Cloud Run ingress hardening: https://cloud.google.com/run/docs/securing/ingress
