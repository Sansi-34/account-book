(function () {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const KDF_ITERATIONS = 250000;

  function bytesToBase64(bytes) {
    let text = "";
    bytes.forEach(byte => {
      text += String.fromCharCode(byte);
    });
    return btoa(text);
  }

  function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  }

  async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptVault(records, key, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plainText = JSON.stringify({
      records,
      updatedAt: new Date().toISOString()
    });
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plainText)
    );

    return {
      version: 1,
      kdf: "PBKDF2-SHA256",
      iterations: KDF_ITERATIONS,
      cipher: "AES-GCM-256",
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decryptPayload(payload, password) {
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(payload.data)
    );
    const parsed = JSON.parse(decoder.decode(decrypted));

    return {
      key,
      salt,
      records: Array.isArray(parsed.records) ? parsed.records : []
    };
  }

  function createSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  window.VaultCrypto = {
    KDF_ITERATIONS,
    createSalt,
    decryptPayload,
    deriveKey,
    encryptVault
  };
})();
