// 検索結果一覧・作者ページ等ではなく、作品そのもののページ（目次/話ページ）でのみボタンを出す。
function isWorkPage() {
  const host = location.hostname;
  const path = location.pathname;
  if (host === "ncode.syosetu.com" || host === "novel18.syosetu.com") {
    // なろうのncodeは必ず"n"+数字+英字（例: n9669bk）。"/search/"等の他ページと区別するため
    // 単なる英数字1セグメントではなく、ncodeの形そのものを要求する。
    return /^\/n\d+[a-z]+(\/\d+)?\/?$/i.test(path);
  }
  if (host === "kakuyomu.jp") {
    return /^\/works\/\d+(\/episodes\/\d+)?\/?$/.test(path);
  }
  if (host === "syosetu.org") {
    return /^\/novel\/\d+(\/\d+\.html)?\/?$/.test(path);
  }
  return false;
}

function init() {
  if (!isWorkPage()) return;

  const button = document.createElement("button");
  button.id = "novelshelf-add-button";
  button.type = "button";
  button.dataset.state = "idle";
  button.textContent = "📚 本棚に追加";
  document.documentElement.appendChild(button);

  function setState(state, text) {
    button.dataset.state = state;
    button.textContent = text;
  }

  button.addEventListener("click", () => {
    if (button.dataset.state === "loading") return;
    setState("loading", "追加中...");
    chrome.runtime.sendMessage({ type: "ADD_TO_SHELF", url: location.href }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setState("error", "拡張機能でエラーが発生しました");
        setTimeout(() => setState("idle", "📚 本棚に追加"), 4000);
        return;
      }
      if (response.ok) {
        setState("success", `「${response.title}」を追加しました`);
        setTimeout(() => setState("idle", "📚 本棚に追加"), 3000);
      } else {
        setState("error", response.message || "追加に失敗しました");
        setTimeout(() => setState("idle", "📚 本棚に追加"), 4000);
      }
    });
  });
}

init();
