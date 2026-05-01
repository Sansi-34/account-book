const nodeCrypto = require("crypto").webcrypto;

global.window = {};
global.crypto = global.crypto || nodeCrypto;
global.btoa = global.btoa || (text => Buffer.from(text, "binary").toString("base64"));
global.atob = global.atob || (text => Buffer.from(text, "base64").toString("binary"));

require("../src/crypto.js");

async function main() {
  const password = "test-password";
  const records = [
    {
      id: "1",
      name: "demo",
      url: "https://example.com",
      username: "user",
      password: "secret",
      note: "hello"
    }
  ];

  const salt = window.VaultCrypto.createSalt();
  const key = await window.VaultCrypto.deriveKey(password, salt);
  const payload = await window.VaultCrypto.encryptVault(records, key, salt);
  const result = await window.VaultCrypto.decryptPayload(payload, password);

  if (JSON.stringify(result.records) !== JSON.stringify(records)) {
    throw new Error("decrypted records do not match original records");
  }

  let wrongPasswordFailed = false;
  try {
    await window.VaultCrypto.decryptPayload(payload, "wrong-password");
  } catch {
    wrongPasswordFailed = true;
  }

  if (!wrongPasswordFailed) {
    throw new Error("wrong password should not decrypt payload");
  }

  console.log("crypto smoke test ok");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
