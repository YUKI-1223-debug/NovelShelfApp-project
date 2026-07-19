// 個人利用専用インスタンス固定。複数インスタンスを使い分ける想定はないためハードコードしている。
const API_BASE = "https://novelshelf.jp/api/v1";

async function getTokens() {
  const { accessToken, refreshToken } = await chrome.storage.local.get(["accessToken", "refreshToken"]);
  return { accessToken, refreshToken };
}

async function setTokens(accessToken, refreshToken) {
  await chrome.storage.local.set({ accessToken, refreshToken });
}

async function clearTokens() {
  await chrome.storage.local.remove(["accessToken", "refreshToken"]);
}

async function refreshAccessToken() {
  const { refreshToken } = await getTokens();
  if (!refreshToken) throw new Error("ログインしてください（拡張機能アイコンから）");
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    throw new Error("セッションが切れました。拡張機能アイコンから再度ログインしてください。");
  }
  const data = await res.json();
  await setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function errorMessageFrom(res) {
  try {
    const body = await res.json();
    return body.message || `エラーが発生しました（${res.status}）`;
  } catch {
    return `エラーが発生しました（${res.status}）`;
  }
}

// アクセストークンが期限切れ(401)の場合のみリフレッシュして1回だけ再試行する。
async function apiFetch(path, options = {}, retry = true) {
  const { accessToken } = await getTokens();
  if (!accessToken) throw new Error("ログインしてください（拡張機能アイコンから）");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && retry) {
    await refreshAccessToken();
    return apiFetch(path, options, false);
  }
  if (!res.ok) throw new Error(await errorMessageFrom(res));
  return res.status === 204 ? null : res.json();
}

async function addToShelf(url) {
  const novel = await apiFetch("/novels/resolve", { method: "POST", body: JSON.stringify({ url }) });
  await apiFetch("/shelf", { method: "POST", body: JSON.stringify({ novelId: novel.id, status: "READING" }) });
  return novel;
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessageFrom(res));
  const data = await res.json();
  await setTokens(data.accessToken, data.refreshToken);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "ADD_TO_SHELF":
      addToShelf(message.url)
        .then((novel) => sendResponse({ ok: true, title: novel.title, novelId: novel.id }))
        .catch((err) => sendResponse({ ok: false, message: err.message }));
      return true; // 非同期でsendResponseを呼ぶことを示す
    case "LOGIN":
      login(message.email, message.password)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, message: err.message }));
      return true;
    case "LOGOUT":
      clearTokens().then(() => sendResponse({ ok: true }));
      return true;
    case "CHECK_AUTH":
      getTokens().then(({ accessToken }) => sendResponse({ authenticated: !!accessToken }));
      return true;
    default:
      return false;
  }
});
