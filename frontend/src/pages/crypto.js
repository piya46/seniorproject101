async function importPublicKey(pemKey) {
  const pemContents = pemKey
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(window.atob(pemContents), c => c.charCodeAt(0));

  return window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

function arrayBufferToBase64(buffer) {
  return window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToUint8Array(base64) {
  let normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (normalizedBase64.length % 4) {
    normalizedBase64 += '=';
  }
  const binaryString = window.atob(normalizedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

//ฟังก์ชันดั้งเดิม (ใช้สำหรับหน้า Home และหน้าอื่นๆ เพื่อไม่ให้ระบบพัง)
export async function encryptPayload(jsonData, serverPublicKeyPem) {
  const publicKey = await importPublicKey(serverPublicKeyPem);
  const securePayload = { ...jsonData, _ts: Date.now(), nonce: window.crypto.randomUUID() };
  
  const aesKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesCryptoKey = await window.crypto.subtle.importKey("raw", aesKeyRaw, "AES-GCM", true, ["encrypt"]);
  const encodedData = new TextEncoder().encode(JSON.stringify(securePayload));
  const encryptedContent = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesCryptoKey, encodedData);

  const tagLength = 16;
  const payload = encryptedContent.slice(0, encryptedContent.byteLength - tagLength);
  const tag = encryptedContent.slice(encryptedContent.byteLength - tagLength);

  const encryptedAesKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, aesKeyRaw);

  return {
    encKey: arrayBufferToBase64(encryptedAesKey),
    iv: arrayBufferToBase64(iv),
    payload: arrayBufferToBase64(payload),
    tag: arrayBufferToBase64(tag)
  };
}

//ฟังก์ชันใหม่พิเศษ (ใช้สำหรับหน้า FormDetail เพื่อจำกุญแจไว้ไขข้อความตอนตอบกลับ)
export async function encryptAndKeepKey(jsonData, serverPublicKeyPem) {
  const publicKey = await importPublicKey(serverPublicKeyPem);
  const securePayload = { ...jsonData, _ts: Date.now(), nonce: window.crypto.randomUUID() };
  
  const aesKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesCryptoKey = await window.crypto.subtle.importKey("raw", aesKeyRaw, "AES-GCM", true, ["encrypt"]);
  const encodedData = new TextEncoder().encode(JSON.stringify(securePayload));
  const encryptedContent = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesCryptoKey, encodedData);

  const tagLength = 16;
  const payload = encryptedContent.slice(0, encryptedContent.byteLength - tagLength);
  const tag = encryptedContent.slice(encryptedContent.byteLength - tagLength);

  const encryptedAesKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, aesKeyRaw);

  return {
    requestPayload: {
      encKey: arrayBufferToBase64(encryptedAesKey),
      iv: arrayBufferToBase64(iv),
      payload: arrayBufferToBase64(payload),
      tag: arrayBufferToBase64(tag)
    },
    aesKeyRaw: aesKeyRaw // แอบคืนค่ากุญแจมาให้ด้วย!
  };
}

//ฟังก์ชันถอดรหัส (รับกุญแจที่แอบจำไว้มาใช้ไขข้อมูล)
export async function decryptResponse(encryptedResponse, aesKeyRaw) {
  try {
    const encryptedBytes = base64ToUint8Array(encryptedResponse.payload);
    const ivBytes = base64ToUint8Array(encryptedResponse.iv);
    const tagBytes = base64ToUint8Array(encryptedResponse.tag);

    const ciphertext = new Uint8Array(encryptedBytes.length + tagBytes.length);
    ciphertext.set(encryptedBytes, 0);
    ciphertext.set(tagBytes, encryptedBytes.length);

    const aesCryptoKey = await window.crypto.subtle.importKey(
      "raw", aesKeyRaw, "AES-GCM", true, ["decrypt"]
    );

    const decryptedBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      aesCryptoKey,
      ciphertext
    );

    let responseString = new TextDecoder().decode(decryptedBytes);
    responseString = responseString.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();

    return JSON.parse(responseString);
  } catch (error) {
    console.error("Decryption Failed:", error);
    throw new Error("Security Error: Unable to decrypt server response.");
  }
}