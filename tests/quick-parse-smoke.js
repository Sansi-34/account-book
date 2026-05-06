function normalizeUrl(url) {
  const value = url.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}

function cleanValue(value) {
  return value
    .replace(/^[：:\s"'“”‘’]+/, "")
    .replace(/["'“”‘’]+$/, "")
    .trim();
}

function findLabeledValue(lines, labels) {
  const labelPattern = labels.join("|");
  const regex = new RegExp("^\\s*(?:" + labelPattern + ")\\s*[:：=\\-]\\s*(.+)$", "i");
  for (const line of lines) {
    const match = line.match(regex);
    if (match && match[1]) return cleanValue(match[1]);
  }
  return "";
}

function guessNameFromUrl(url) {
  try {
    const hostname = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function parseQuickImport(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const joined = lines.join("\n");

  const parsed = {
    name: findLabeledValue(lines, ["名称", "名字", "标题", "网站", "站点", "name", "site", "title"]),
    url: findLabeledValue(lines, ["网址", "链接", "地址", "url", "link"]),
    username: findLabeledValue(lines, ["账号", "账户", "用户名", "用户", "邮箱", "手机号", "登录名", "user", "username", "account", "email", "phone", "login"]),
    password: findLabeledValue(lines, ["密码", "口令", "pass", "password", "pwd"]),
    note: findLabeledValue(lines, ["备注", "说明", "note", "memo"])
  };

  if (!parsed.url) {
    const urlMatch = joined.match(/https?:\/\/[^\s"'<>，。；、]+|(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>，。；、]*)?/i);
    if (urlMatch) parsed.url = cleanValue(urlMatch[0]);
  }

  if (!parsed.username) {
    const emailMatch = joined.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    const phoneMatch = joined.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/);
    parsed.username = emailMatch ? emailMatch[0] : phoneMatch ? phoneMatch[0] : "";
  }

  if (!parsed.name && parsed.url) {
    parsed.name = guessNameFromUrl(parsed.url);
  }

  return parsed;
}

const sample = `
名称：GitHub
网址：https://github.com
账号：sansi@example.com
密码：S3cret!123
备注：主账号
`;

const parsed = parseQuickImport(sample);

if (parsed.name !== "GitHub") throw new Error("name parse failed");
if (parsed.url !== "https://github.com") throw new Error("url parse failed");
if (parsed.username !== "sansi@example.com") throw new Error("username parse failed");
if (parsed.password !== "S3cret!123") throw new Error("password parse failed");
if (parsed.note !== "主账号") throw new Error("note parse failed");

console.log("quick parse smoke test ok");
