// 個人利用専用インスタンス固定。ミニPCの tailnet 入口(個人利用アプリ化 S2-6、2026-10〜)。
// ログインは廃止した: サーバーのオーナー固定モードが、tailnet から来たトークン無しのリクエストを
// オーナーとして扱う。そのため PC が Tailscale に参加していれば、そのまま使える。
// manifest.json の "key" で拡張機能の ID を固定している(noknmckhajflpgeidknhdadldnfiedin)。
// backend の CORS はこの ID のオリジンだけを許可しているので、key を変えたら backend 側も変えること。
const API_BASE = "https://minipc.tail0347f4.ts.net:8445/api/v1";
const HEALTH_URL = "https://minipc.tail0347f4.ts.net:8445/actuator/health";
const TIMEOUT_MS = 15000;

const NOT_CONNECTED_MESSAGE =
  "NovelShelf のサーバーに接続できません。Tailscale が ON か確認してください（平日 1:00〜7:00 はミニPCが休止中です）。";

async function errorMessageFrom(res) {
  if (res.status === 401) {
    return "このネットワークからは使えません。Tailscale が ON か確認してください。";
  }
  try {
    const body = await res.json();
    return body.message || `エラーが発生しました（${res.status}）`;
  } catch {
    return `エラーが発生しました（${res.status}）`;
  }
}

async function fetchWithTimeout(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error(NOT_CONNECTED_MESSAGE);
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(await errorMessageFrom(res));
  return res.status === 204 ? null : res.json();
}

async function addToShelf(url) {
  const novel = await apiFetch("/novels/resolve", { method: "POST", body: JSON.stringify({ url }) });
  await apiFetch("/shelf", { method: "POST", body: JSON.stringify({ novelId: novel.id, status: "READING" }) });
  return novel;
}

async function checkConnection() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "ADD_TO_SHELF":
      addToShelf(message.url)
        .then((novel) => sendResponse({ ok: true, title: novel.title, novelId: novel.id }))
        .catch((err) => sendResponse({ ok: false, message: err.message }));
      return true; // 非同期でsendResponseを呼ぶことを示す
    case "CHECK_CONNECTION":
      checkConnection().then((connected) => sendResponse({ connected }));
      return true;
    default:
      return false;
  }
});

// 以前のバージョンで保存していたトークンは使わないので消しておく
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(["accessToken", "refreshToken"]);
});
