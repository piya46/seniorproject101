const crypto = require('crypto');
// สร้าง Random Key ขนาด 32 Bytes (256 bits) และแปลงเป็น hex string
const key = crypto.randomBytes(32).toString('hex'); 

console.log("=== 🔐 DB ENCRYPTION KEY (For AES-256-GCM) ===");
console.log("Save this to Secret Manager (Name: DB_ENCRYPTION_KEY):");
console.log(key);
console.log("==============================================");