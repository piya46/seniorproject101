# Cloud Armor Standard Runbook

Last updated: `2026-04-03`

เอกสารนี้สรุป baseline ที่แนะนำสำหรับเปิด `Google Cloud Armor Standard` กับระบบนี้โดยเน้น

- กัน Layer 7 abuse ก่อนถึง Cloud Run
- ลด false positives ใน flow login / upload / validation
- คุมค่าใช้จ่ายให้อยู่ในระดับเริ่มต้น

## สำคัญก่อนเริ่ม

Cloud Armor จะใช้ได้เมื่อ service ถูกวางหลัง **External HTTP(S) Load Balancer** ผ่าน **serverless NEG**

- ถ้ายังใช้ `run.app` URL ตรง ๆ จะยัง attach Cloud Armor policy ไม่ได้
- ถ้ามี custom domain ผ่าน external Application Load Balancer อยู่แล้ว ให้ใช้ backend service ของ load balancer นั้น

สถานะปัจจุบันของโปรเจกต์นี้:

- deploy หลักยังยึด `Cloud Run run.app` แบบ OIDC + private backend
- `deploy.sh` ไม่ได้สร้าง external load balancer / serverless NEG / Cloud Armor ให้อัตโนมัติ
- ถ้ายังไม่เพิ่ม LB ให้ถือว่าเอกสารนี้เป็น future infra runbook ไม่ใช่สิ่งที่ deploy หลักจะทำทันที

เอกสารนี้จึงเป็น runbook สำหรับ infra layer ไม่ใช่การแก้ที่ Cloud Run service โดยตรง

## Baseline ที่แนะนำ

เริ่มด้วยชุดเล็กก่อน:

1. `1 security policy`
2. `2-3 rules`
3. เปิดแค่ rate limiting สำหรับ API เสี่ยงก่อน

### Rules ชุดเริ่มต้น

1. `default allow`
   - traffic ปกติผ่าน
2. `rate limit / throttle` สำหรับ path เสี่ยง
   - `/api/v1/oidc/*`
   - `/api/v1/auth/*`
   - `/api/v1/session/*`
   - `/api/v1/upload`
   - `/api/v1/validation/check-completeness`
   - `/api/v1/merge`
   - `/api/v1/chat/recommend`
3. `optional deny rules`
   - เพิ่มภายหลังเมื่อมี log pattern ชัดเจน
   - ไม่แนะนำให้เปิดหนักตั้งแต่วันแรก

## ค่าใช้จ่ายคร่าว ๆ

สำหรับ `Cloud Armor Standard`

- policy ประมาณ `$5/เดือน`
- rule ประมาณ `$1/เดือน/กฎ`
- requests ประมาณ `$0.75 / 1,000,000 requests`

กรณีเริ่มต้น 1 policy + 3 rules:

- ที่ 1 ล้าน requests/เดือน: ประมาณ `$8.75/เดือน`
- ที่ 10 ล้าน requests/เดือน: ประมาณ `$15.50/เดือน`
- ที่ 50 ล้าน requests/เดือน: ประมาณ `$45.50/เดือน`

## ตัวอย่าง rollout แบบ conservative

### Phase 1

- สร้าง security policy
- เปิด rule throttle สำหรับ API เสี่ยง
- monitor 1-2 สัปดาห์

### Phase 2

- ดู false positives
- ปรับ threshold ให้เข้ากับ traffic จริง
- ค่อยเพิ่ม deny rules หรือ geo/IP reputation rules ภายหลัง

## ตัวอย่าง expression ที่ใช้คิด rule

แนวคิดสำหรับ path matching:

```text
request.path.matches('^/api/v1/(oidc|auth|session)(/.*)?$')
```

```text
request.path.matches('^/api/v1/(upload|validation/check-completeness|merge|chat/recommend)$')
```

## Threshold เริ่มต้นที่แนะนำ

เริ่มจากค่าหลวมก่อนแล้วค่อย tighten:

- auth/session paths:
  - `60 requests / 1 minute / IP`
- upload / validation / merge / chat:
  - `30 requests / 1 minute / IP`

หมายเหตุ:

- ถ้าระบบใช้หน้าเดียวจาก network เดียวกันจำนวนมาก ควรเผื่อ false positive
- ถ้ามี batch tests หรือ automated QA จาก IP เดียว ให้แยก allowlist ก่อน

## สิ่งที่ต้องเช็กก่อนเปิดจริง

- frontend/backend อยู่หลัง load balancer แล้วจริง
- มี access logs พอสำหรับดู false positives
- มีคน monitor ช่วง 24-72 ชั่วโมงแรก
- มี rollback plan เอา policy ออกหรือ disable rule ได้ทันที

## สิ่งที่ไม่ควรทำวันแรก

- block ประเทศทั้งหมด
- เปิด WAF preconfigured rules ทุกตัวพร้อมกัน
- deny request แรงเกินโดยยังไม่มี baseline traffic

## หลังเปิดใช้งาน

ควรดู metric/alert ต่อไปนี้:

- Cloud Armor denied requests
- Cloud Armor throttled requests
- Cloud Run request count / 4xx / 5xx
- backend security events ใน Cloud Logging

## เอกสารที่เกี่ยวข้อง

- [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md)
- [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md)
- [scripts/createSecurityLogMetrics.sh](./scripts/createSecurityLogMetrics.sh)
