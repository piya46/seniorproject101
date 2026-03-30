# PFS Protocol V2 Design

Last updated: `2026-03-31`

เอกสารนี้สรุปแนวทางออกแบบ secure payload transport รุ่นถัดไป เพื่อยกระดับจาก RSA envelope แบบ static ไปสู่แนวทางที่มี Perfect Forward Secrecy (PFS)

เป้าหมาย:

- ยังคง payload confidentiality/integrity แบบ application-level encryption
- ลดผลกระทบย้อนหลังหาก server private key หลุดในอนาคต
- รองรับ gradual rollout โดยไม่ทำลาย client/runtime เดิม

## Current V1 Summary

v1 ปัจจุบันใช้แนวทางนี้:

- client สุ่ม AES-256-GCM key
- client ใช้ RSA public key ของ backend เข้ารหัส AES key
- backend ใช้ RSA private key ถอด `encKey`
- request/response ใช้ AES-GCM key เดียวกันต่อ request

จุดแข็ง:

- transport confidentiality/integrity ดี
- รองรับ replay protection ผ่าน `_ts` + `nonce`
- rotate RSA key ได้แบบ current/previous slot

ข้อจำกัด:

- ไม่มี PFS
- ถ้า private key ของ backend ถูกขโมยและ attacker มี traffic เก่าที่ capture ไว้ จะสามารถถอด `encKey` ย้อนหลังได้

## V2 Goals

- มี ephemeral key agreement ต่อ request/session
- server long-term key ใช้สำหรับ authentication ของ handshake ไม่ใช่ถอด traffic ย้อนหลัง
- รองรับ mixed mode ระหว่าง `v1` และ `v2`
- ไม่ลด replay protection, CSRF, session auth, หรือ response encryption เดิม

## Proposed Cryptographic Shape

แนวทางที่แนะนำ:

- key agreement: `ECDH` แบบ ephemeral-ephemeral หรือ client ephemeral + server signed ephemeral
- curve: `X25519` ถ้า runtime/client stack รองรับสะดวก หรือ `P-256` เป็น fallback
- KDF: `HKDF-SHA256`
- AEAD: `AES-256-GCM`
- transcript binding: include protocol version, request method, request path, `_ts`, `nonce`, และ handshake fields ใน HKDF context/AAD

## Handshake Model

ข้อเสนอสำหรับ browser/BFF-friendly flow:

1. backend มี long-term signing key แยกจาก transport key
2. client ขอ handshake metadata จาก `GET /api/v2/auth/handshake`
3. backend ส่ง:
   - `protocol_version = v2`
   - `server_key_id`
   - `server_ephemeral_public_key`
   - `server_ephemeral_expires_at`
   - `signature` ที่ sign ทับ transcript
4. client verify signature ด้วย pinned/backend public signing key
5. client สร้าง `client_ephemeral_public_key`
6. ทั้งสองฝั่ง derive shared secret ผ่าน ECDH
7. derive `request_key` และ `response_key` ผ่าน HKDF
8. client ส่ง request encrypted package พร้อม `client_ephemeral_public_key`
9. backend derive key, decrypt request, process, แล้วเข้ารหัส response ด้วย `response_key`

## Request Envelope Example

```json
{
  "protocol_version": "v2",
  "key_id": "sig-v1",
  "client_ephemeral_public_key": "<base64>",
  "server_ephemeral_key_id": "<opaque-id>",
  "iv": "<base64>",
  "tag": "<base64>",
  "payload": "<base64>"
}
```

plaintext ด้านในยังคงมี:

- `_ts`
- `nonce`
- business payload fields

## Response Envelope Example

```json
{
  "protocol_version": "v2",
  "iv": "<base64>",
  "tag": "<base64>",
  "payload": "<base64>"
}
```

## Replay And Binding Requirements

v2 ต้องยังคง replay protection เดิม และ bind ให้แน่นขึ้น:

- `_ts` และ `nonce` ยังเป็น required fields
- AAD ควร bind:
  - `protocol_version`
  - HTTP method
  - canonical request path
  - session identifier หรือ auth context ที่จำเป็น
- server ephemeral key ต้องมีอายุสั้น
- server ต้อง reject handshake metadata ที่หมดอายุ

## Rollout Plan

ลำดับ rollout ที่แนะนำ:

1. เพิ่ม `protocol_version` negotiation ใน runtime
2. เปิด endpoint handshake สำหรับ v2
3. runtime รองรับทั้ง `v1` และ `v2`
4. frontend/BFF client rollout ใช้ `v2` แบบ opt-in
5. track metrics ว่า traffic `v2` ครบหรือยัง
6. เมื่อมั่นใจแล้วค่อย deprecate `v1`

หลักสำคัญ:

- อย่า patch ทับ `v1`
- ให้ `v2` เป็น protocol แยกชัดเจน
- ใช้ feature flag เพื่อ rollback ได้

## Operational Notes

- ควรมี metric แยก `v1` / `v2`
- ควรมี warning ถ้า client ยังใช้ protocol เก่านานเกิน policy
- server ephemeral key ควร cache แบบสั้นและ rotate อัตโนมัติ
- signing key rotation ต้องแยกจาก transport protocol state

## Non-Goals

สิ่งที่เอกสารนี้ยังไม่ลงรายละเอียด:

- exact browser crypto implementation
- exact message framing ของ multipart upload
- migration ของ Postman/dev tooling
- formal proof หรือ external audit artifacts

## Recommended Next Step

ก่อน implement จริง ควรทำ:

1. threat model addendum สำหรับ `v2`
2. handshake transcript spec แบบ field-by-field
3. client compatibility plan สำหรับ frontend/BFF
4. telemetry plan สำหรับ dual-stack `v1` + `v2`
