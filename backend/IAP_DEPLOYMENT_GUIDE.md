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

### 1. เตรียม Cloud Run

- Deploy service นี้ด้วย ingress เป็น `internal-and-cloud-load-balancing`
- ให้ service account ของ Cloud Run มีสิทธิ์เท่าที่ระบบต้องใช้จริงเท่านั้น
- ตรวจว่าระบบยังทำงานได้ปกติโดยไม่ปิด auth layer เดิม

สคริปต์ [deploy.sh](/Users/pst./senior/backend/deploy.sh) รองรับทั้ง env สำหรับ IAP และโหมด auto-configure load balancer/IAP

### เปิด IAP แบบละเอียด

ลำดับที่แนะนำสำหรับโปรเจกต์นี้:

1. Deploy backend แบบทดสอบก่อน
   ตั้ง `IAP_ENABLED=false` และ `AUTO_CONFIGURE_IAP_LB=false`
   ในโหมดนี้ `deploy.sh` จะปรับ Cloud Run ingress เป็น `all` อัตโนมัติ เพื่อให้ทดสอบ service ตรงได้

2. ยืนยันว่า backend ทำงานปกติบน Cloud Run
   ทดสอบ endpoint เช่น `/healthz`, `/api/v1/auth/public-key`, และ flow หลักของระบบ

3. เตรียมโดเมนจริงที่จะวางหน้า Load Balancer
   ตัวอย่างเช่น `request.chula.ac.th`
   โดเมนนี้ต้องเป็นโดเมนที่คุณควบคุม DNS ได้

4. กำหนด principal ที่จะอนุญาตผ่าน IAP
   แนะนำใช้ Google Group เช่น `group:sci-request-users@chula.ac.th`
   ถ้าต้องการกว้างระดับโดเมน ค่อยใช้ `domain:chula.ac.th`

5. เปิดโหมด IAP/LB ใน `deploy.sh`
   ตั้ง:
   - `IAP_ENABLED=true`
   - `AUTO_CONFIGURE_IAP_LB=true`
   - `LB_DOMAIN_NAMES=<โดเมนจริง>`
   - `IAP_ACCESS_MEMBERS=<group หรือ domain ที่อนุญาต>`

6. รัน `deploy.sh`
   สคริปต์จะ:
   - deploy Cloud Run ใหม่ด้วย ingress เป็น `internal-and-cloud-load-balancing`
   - สร้าง global IP
   - สร้าง managed certificate
   - สร้าง serverless NEG
   - สร้าง backend service
   - สร้าง URL map / HTTPS proxy / forwarding rule
   - เปิด IAP บน backend service
   - เพิ่ม IAM binding ให้ IAP
   - คำนวณ `IAP_EXPECTED_AUDIENCE` และอัปเดตกลับเข้า Cloud Run

7. เอา DNS ที่สคริปต์พิมพ์ออกมาไปชี้ใน zone จริง
   ตัวอย่าง:
   `request.chula.ac.th -> 34.x.x.x`

8. รอ DNS propagation และ certificate provisioning
   ถ้าตั้ง `WAIT_FOR_DNS_PROPAGATION=true` และ `WAIT_FOR_MANAGED_CERTIFICATE=true`
   สคริปต์จะช่วย poll ให้

9. ทดสอบหน้าใช้งานจริงผ่านโดเมน LB
   สิ่งที่ควรเห็น:
   - ผู้ใช้ถูกพาไป login Google
   - ผู้ใช้ที่ไม่อยู่ในสิทธิ์ IAP เข้าไม่ได้
   - ผู้ใช้ที่ผ่าน IAP แล้วแต่ไม่มี session เดิมของระบบ ยังถูก backend ปฏิเสธ

10. ตรวจ defense-in-depth ของ backend
   backend จะยังตรวจ:
   - signed IAP assertion
   - allowed domains `chula.ac.th,student.chula.ac.th`
   - session cookie/JWT เดิม
   - encryption/rate limit/origin/file validation เดิม

11. ยืนยันว่าไม่มี direct bypass
   ในโหมด IAP จริง Cloud Run จะถูก deploy ด้วย ingress `internal-and-cloud-load-balancing`
   จึงควรเข้าผ่าน LB domain เป็นหลัก ไม่ใช่ทดสอบผ่าน `run.app`

ตอนนี้ถ้าตั้ง `AUTO_CONFIGURE_IAP_LB=true` สคริปต์จะสร้างให้อัตโนมัติได้ถึง:

- global IP address
- managed SSL certificate
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

สิ่งที่ยังต้องทำเอง:

- ชี้ DNS ของโดเมนจริงไปที่ global IP ที่สคริปต์สร้าง
- รอ managed certificate เปลี่ยนเป็น `ACTIVE`
- เตรียม OAuth client ID/secret สำหรับ IAP
- ระบุ principal ที่ต้องอนุญาตผ่าน `IAP_ACCESS_MEMBERS`

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

แนะนำ:

- ใช้ Google Group เป็นหลัก
- ถ้าจำเป็นค่อยใช้ `domain:chula.ac.th`

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

- ผู้ใช้ `@chula.ac.th` ที่อยู่ใน group เข้าได้
- ผู้ใช้ Google account ส่วนตัวเข้าไม่ได้
- ผู้ใช้ `@chula.ac.th` แต่ไม่อยู่ใน group เข้าไม่ได้
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

โหมด IAP จริง:

- `IAP_ENABLED=true`
- `AUTO_CONFIGURE_IAP_LB=true`
- `deploy.sh` จะตั้ง Cloud Run ingress เป็น `internal-and-cloud-load-balancing`
- ใช้เมื่อมีโดเมนจริงและพร้อมให้ LB/IAP เป็นด่านหน้า

## Example Deploy Command

ตัวอย่าง env ก่อนรัน [deploy.sh](/Users/pst./senior/backend/deploy.sh):

```bash
export PROJECT_ID="your-project-id"
export SERVICE_NAME="sci-request-system"
export REGION="asia-southeast1"
export CLOUD_RUN_INGRESS="internal-and-cloud-load-balancing"
export IAP_ENABLED="true"
export IAP_ALLOWED_DOMAINS="chula.ac.th,student.chula.ac.th"
export IAP_REQUIRE_HOSTED_DOMAIN="true"
export AUTO_CONFIGURE_IAP_LB="true"
export LB_DOMAIN_NAMES="request.example.chula.ac.th"
export IAP_ACCESS_MEMBERS="group:sci-request-users@chula.ac.th,group:sci-request-admins@chula.ac.th"
export WAIT_FOR_DNS_PROPAGATION="true"
export WAIT_FOR_MANAGED_CERTIFICATE="true"
export POST_DEPLOY_HEALTHCHECK_ENABLED="true"

cd /Users/pst./senior/backend
./deploy.sh
```

## Operational Notes

- ถ้า Chula ใช้ Google Workspace จริง การบังคับ `@chula.ac.th` และ `@student.chula.ac.th` ผ่าน IAP ทำได้ตรงไปตรงมา
- ถ้า identity จริงของ Chula อยู่บน SSO ภายนอกหรือ third-party federation ต้องยืนยันก่อนว่า IAP จะเห็น identity เป็นรูปแบบใด
- ถ้าต้องการ authorization ระดับละเอียดกว่าทั้งโดเมน ให้ใช้ Google Group ที่ IAP/IAM เป็นตัวบังคับ และปล่อยให้ backend ทำ domain verification เป็น defense in depth

## References

- IAP signed headers: https://cloud.google.com/iap/docs/signed-headers-howto
- IAP identity headers: https://cloud.google.com/iap/docs/identity-howto
- Enabling IAP for Cloud Run: https://docs.cloud.google.com/iap/docs/enabling-cloud-run
- Cloud Run ingress hardening: https://cloud.google.com/run/docs/securing/ingress
