(function () {
  "use strict";

  const STORAGE_KEY = "local-account-vault-v1";

  function readPayload() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writePayload(payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function removePayload() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function readRawPayload() {
    return localStorage.getItem(STORAGE_KEY);
  }

  window.VaultStorage = {
    STORAGE_KEY,
    readPayload,
    readRawPayload,
    removePayload,
    writePayload
  };
})();
