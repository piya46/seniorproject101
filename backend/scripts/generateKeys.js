// scripts/generateKeys.js
const crypto = require('crypto');

// สร้าง RSA Key Pair (4096 bit)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// แปลงเป็น Base64 เพื่อให้เก็บใน Secret Manager ได้ง่าย (บรรทัดเดียว)
const privBase64 = Buffer.from(privateKey).toString('base64');
const pubBase64 = Buffer.from(publicKey).toString('base64');

console.log("=== 🔐 COPY VALUES BELOW TO SECRET MANAGER ===");
console.log("\n[Secret Name: Gb_PRIVATE_KEY_BASE64]");
console.log(privBase64);
console.log("\n[Secret Name: Gb_PUBLIC_KEY_BASE64]");
console.log(pubBase64);
console.log("\n============================================");