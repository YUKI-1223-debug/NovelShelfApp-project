const status = document.getElementById("status");
const retryBtn = document.getElementById("retryBtn");

function check() {
  status.textContent = "接続を確認しています…";
  status.className = "";
  retryBtn.style.display = "none";
  chrome.runtime.sendMessage({ type: "CHECK_CONNECTION" }, (res) => {
    if (res?.connected) {
      status.textContent =
        "接続できています。なろう・カクヨム・ハーメルンの作品ページを開くと、右下に「本棚に追加」ボタンが表示されます。";
      status.className = "ok";
    } else {
      status.textContent =
        "サーバーに接続できません。Tailscale が ON か確認してください（平日 1:00〜7:00 はミニPCが休止中です）。";
      status.className = "error";
      retryBtn.style.display = "block";
    }
  });
}

retryBtn.addEventListener("click", check);
check();
