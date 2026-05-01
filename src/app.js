(function () {
  "use strict";

  const vaultCrypto = window.VaultCrypto;
  const vaultStorage = window.VaultStorage;
  const AUTO_LOCK_MS = 10 * 60 * 1000;
  const CLIPBOARD_CLEAR_MS = 30 * 1000;

  const state = {
    masterKey: null,
    vault: [],
    selectedId: null,
    salt: null,
    passwordVisible: false,
    autoLockTimer: null,
    clipboardTimer: null,
    lastCopiedText: ""
  };

  const el = {
    status: document.querySelector("#status"),
    unlockView: document.querySelector("#unlockView"),
    appView: document.querySelector("#appView"),
    masterPassword: document.querySelector("#masterPassword"),
    unlockBtn: document.querySelector("#unlockBtn"),
    newVaultBtn: document.querySelector("#newVaultBtn"),
    addBtn: document.querySelector("#addBtn"),
    lockBtn: document.querySelector("#lockBtn"),
    exportBtn: document.querySelector("#exportBtn"),
    importBtn: document.querySelector("#importBtn"),
    importFile: document.querySelector("#importFile"),
    searchInput: document.querySelector("#searchInput"),
    counter: document.querySelector("#counter"),
    items: document.querySelector("#items"),
    editorTitle: document.querySelector("#editorTitle"),
    openUrlBtn: document.querySelector("#openUrlBtn"),
    nameInput: document.querySelector("#nameInput"),
    tagInput: document.querySelector("#tagInput"),
    urlInput: document.querySelector("#urlInput"),
    usernameInput: document.querySelector("#usernameInput"),
    passwordInput: document.querySelector("#passwordInput"),
    togglePasswordBtn: document.querySelector("#togglePasswordBtn"),
    noteInput: document.querySelector("#noteInput"),
    copyUserBtn: document.querySelector("#copyUserBtn"),
    copyPassBtn: document.querySelector("#copyPassBtn"),
    copyUrlBtn: document.querySelector("#copyUrlBtn"),
    generateBtn: document.querySelector("#generateBtn"),
    clearBtn: document.querySelector("#clearBtn"),
    deleteBtn: document.querySelector("#deleteBtn"),
    saveBtn: document.querySelector("#saveBtn")
  };

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function showStatus(message) {
    el.status.textContent = message;
  }

  function isUnlocked() {
    return Boolean(state.masterKey);
  }

  function normalizeUrl(url) {
    const value = url.trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return "https://" + value;
  }

  function isValidPayload(payload) {
    return Boolean(
      payload &&
      payload.version === 1 &&
      payload.kdf === "PBKDF2-SHA256" &&
      (!payload.cipher || payload.cipher === "AES-GCM-256") &&
      typeof payload.salt === "string" &&
      typeof payload.iv === "string" &&
      typeof payload.data === "string"
    );
  }

  function scheduleAutoLock() {
    clearTimeout(state.autoLockTimer);
    if (!isUnlocked()) return;

    state.autoLockTimer = setTimeout(() => {
      lock("太久没操作，已自动锁定");
    }, AUTO_LOCK_MS);
  }

  function noteActivity() {
    if (isUnlocked()) scheduleAutoLock();
  }

  async function clearClipboardLater(copiedText) {
    clearTimeout(state.clipboardTimer);
    state.lastCopiedText = copiedText;
    state.clipboardTimer = setTimeout(async () => {
      try {
        const currentText = navigator.clipboard.readText
          ? await navigator.clipboard.readText()
          : copiedText;
        if (state.lastCopiedText === copiedText && currentText === copiedText) {
          await navigator.clipboard.writeText("");
          state.lastCopiedText = "";
          showStatus("剪贴板已清空");
        }
      } catch {
        state.lastCopiedText = "";
      }
    }, CLIPBOARD_CLEAR_MS);
  }

  async function saveVault() {
    const payload = await vaultCrypto.encryptVault(state.vault, state.masterKey, state.salt);
    vaultStorage.writePayload(payload);
    showStatus("已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  }

  async function unlock() {
    const password = el.masterPassword.value;
    if (!password) {
      showStatus("先输入打开密码");
      return;
    }

    const stored = vaultStorage.readPayload();
    try {
      if (stored) {
        if (!isValidPayload(stored)) throw new Error("invalid-payload");
        const result = await vaultCrypto.decryptPayload(stored, password);
        state.masterKey = result.key;
        state.salt = result.salt;
        state.vault = result.records;
      } else {
        state.salt = vaultCrypto.createSalt();
        state.masterKey = await vaultCrypto.deriveKey(password, state.salt);
        state.vault = [];
        await saveVault();
      }

      el.masterPassword.value = "";
      el.unlockView.hidden = true;
      el.appView.style.display = "grid";
      renderList();
      clearForm();
      scheduleAutoLock();
      showStatus("已解锁");
    } catch {
      showStatus("密码不对，或者备份文件有问题");
    }
  }

  function lock(message) {
    clearTimeout(state.autoLockTimer);
    clearTimeout(state.clipboardTimer);
    state.masterKey = null;
    state.vault = [];
    state.selectedId = null;
    state.salt = null;
    state.lastCopiedText = "";
    el.appView.style.display = "none";
    el.unlockView.hidden = false;
    clearForm();
    showStatus(message || "已锁住");
    el.masterPassword.focus();
  }

  function currentRecordFromForm() {
    return {
      id: state.selectedId || makeId(),
      name: el.nameInput.value.trim(),
      tag: el.tagInput.value.trim(),
      url: normalizeUrl(el.urlInput.value),
      username: el.usernameInput.value.trim(),
      password: el.passwordInput.value,
      note: el.noteInput.value.trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function fillForm(record) {
    state.selectedId = record.id;
    el.editorTitle.textContent = record.name || "未命名记录";
    el.nameInput.value = record.name || "";
    el.tagInput.value = record.tag || "";
    el.urlInput.value = record.url || "";
    el.usernameInput.value = record.username || "";
    el.passwordInput.value = record.password || "";
    el.noteInput.value = record.note || "";
    renderList();
    noteActivity();
  }

  function clearForm() {
    state.selectedId = null;
    el.editorTitle.textContent = "新记录";
    el.nameInput.value = "";
    el.tagInput.value = "";
    el.urlInput.value = "";
    el.usernameInput.value = "";
    el.passwordInput.value = "";
    el.noteInput.value = "";
    renderList();
  }

  function matchesSearch(record, query) {
    if (!query) return true;
    return [record.name, record.tag, record.url, record.username, record.note]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function renderList() {
    const query = el.searchInput.value.trim().toLowerCase();
    const records = state.vault
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .filter(record => matchesSearch(record, query));

    el.items.innerHTML = "";
    el.counter.textContent = records.length + " / " + state.vault.length + " 条记录";

    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = state.vault.length ? "没搜到" : "还没有记录，先加一条";
      el.items.appendChild(empty);
      return;
    }

    records.forEach(record => {
      const item = document.createElement("button");
      item.className = "item" + (record.id === state.selectedId ? " active" : "");
      item.type = "button";
      item.innerHTML = "<strong></strong><span></span><span></span>";
      item.querySelector("strong").textContent = record.name || "未命名记录";

      const spans = item.querySelectorAll("span");
      spans[0].textContent = record.username || "未填写账号";
      spans[1].textContent = record.url || record.tag || "无网址";
      item.addEventListener("click", () => fillForm(record));
      el.items.appendChild(item);
    });
  }

  async function saveCurrentRecord() {
    const record = currentRecordFromForm();
    if (!record.name && !record.url && !record.username) {
      showStatus("至少写点名称、网址或账号");
      return;
    }

    const index = state.vault.findIndex(item => item.id === record.id);
    if (index >= 0) {
      state.vault[index] = record;
    } else {
      state.vault.push(record);
    }

    state.selectedId = record.id;
    await saveVault();
    fillForm(record);
    noteActivity();
  }

  async function deleteCurrentRecord() {
    if (!state.selectedId) {
      clearForm();
      return;
    }

    const record = state.vault.find(item => item.id === state.selectedId);
    const name = record && record.name ? record.name : "这条记录";
    if (!confirm("确定删除「" + name + "」吗？")) return;

    state.vault = state.vault.filter(item => item.id !== state.selectedId);
    await saveVault();
    clearForm();
    noteActivity();
  }

  async function copyText(text, label) {
    if (!text) {
      showStatus(label + "为空");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      await clearClipboardLater(text);
      showStatus("已复制" + label + "，30 秒后清空剪贴板");
      noteActivity();
    } catch {
      showStatus("复制失败，请手动选择复制");
    }
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    let password = "";
    bytes.forEach(byte => {
      password += chars[byte % chars.length];
    });
    el.passwordInput.value = password;
    showStatus("已生成随机密码");
    noteActivity();
  }

  async function exportVault() {
    await saveVault();
    const payload = vaultStorage.readRawPayload();
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "account-vault-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
    showStatus("备份已保存");
    noteActivity();
  }

  async function importVault(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!isValidPayload(payload)) throw new Error("invalid-payload");

      const password = prompt("输入这个备份的打开密码");
      if (!password) return;

      const result = await vaultCrypto.decryptPayload(payload, password);
      state.masterKey = result.key;
      state.salt = result.salt;
      state.vault = result.records;
      vaultStorage.writePayload(payload);
      el.unlockView.hidden = true;
      el.appView.style.display = "grid";
      clearForm();
      renderList();
      scheduleAutoLock();
      showStatus("备份已恢复");
    } catch {
      showStatus("恢复失败：文件、密码或内容不对");
    } finally {
      el.importFile.value = "";
    }
  }

  function resetVault() {
    if (!confirm("这会删除当前浏览器里的账号本数据。已经备份过的文件不会受影响。确定继续吗？")) return;
    vaultStorage.removePayload();
    lock("已清空，可以设置新密码");
  }

  function openCurrentUrl() {
    const url = normalizeUrl(el.urlInput.value);
    if (!url) {
      showStatus("网址为空");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    noteActivity();
  }

  function bindEvents() {
    el.unlockBtn.addEventListener("click", unlock);
    el.masterPassword.addEventListener("keydown", event => {
      if (event.key === "Enter") unlock();
    });
    el.newVaultBtn.addEventListener("click", resetVault);
    el.addBtn.addEventListener("click", () => {
      clearForm();
      noteActivity();
    });
    el.lockBtn.addEventListener("click", () => lock());
    el.exportBtn.addEventListener("click", exportVault);
    el.importBtn.addEventListener("click", () => el.importFile.click());
    el.importFile.addEventListener("change", event => importVault(event.target.files[0]));
    el.searchInput.addEventListener("input", () => {
      renderList();
      noteActivity();
    });
    el.saveBtn.addEventListener("click", saveCurrentRecord);
    el.deleteBtn.addEventListener("click", deleteCurrentRecord);
    el.clearBtn.addEventListener("click", () => {
      clearForm();
      noteActivity();
    });
    el.generateBtn.addEventListener("click", generatePassword);
    el.copyUserBtn.addEventListener("click", () => copyText(el.usernameInput.value, "账号"));
    el.copyPassBtn.addEventListener("click", () => copyText(el.passwordInput.value, "密码"));
    el.copyUrlBtn.addEventListener("click", () => copyText(normalizeUrl(el.urlInput.value), "网址"));
    el.openUrlBtn.addEventListener("click", openCurrentUrl);
    el.togglePasswordBtn.addEventListener("click", () => {
      state.passwordVisible = !state.passwordVisible;
      el.passwordInput.type = state.passwordVisible ? "text" : "password";
      el.togglePasswordBtn.textContent = state.passwordVisible ? "隐" : "显";
      noteActivity();
    });

    ["pointerdown", "keydown"].forEach(eventName => {
      document.addEventListener(eventName, noteActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && isUnlocked()) scheduleAutoLock();
    });
  }

  bindEvents();

  if (!vaultStorage.readPayload()) {
    showStatus("第一次打开");
  }
})();
