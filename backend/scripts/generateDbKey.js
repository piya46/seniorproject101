// backend/scripts/generateDbKey.js
const crypto = require('crypto');

// สร้าง Random Key ขนาด 32 Bytes (256 bits) และแปลงเป็น hex string
const key = crypto.randomBytes(32).toString('hex'); 

console.log("=== 🔐 DB ENCRYPTION KEY (Save this to Secret Manager) ===");
console.log("\n[Secret Name: DB_ENCRYPTION_KEY]");
console.log(key);
console.log("\n========================================================");