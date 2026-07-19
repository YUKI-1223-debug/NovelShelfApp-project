const loginForm = document.getElementById("loginForm");
const loggedIn = document.getElementById("loggedIn");
const status = document.getElementById("status");

function render(authenticated) {
  loginForm.style.display = authenticated ? "none" : "block";
  loggedIn.style.display = authenticated ? "block" : "none";
}

chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (res) => render(!!res?.authenticated));

document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  status.textContent = "";
  status.className = "";
  if (!email || !password) {
    status.textContent = "メールアドレスとパスワードを入力してください。";
    status.className = "error";
    return;
  }
  chrome.runtime.sendMessage({ type: "LOGIN", email, password }, (res) => {
    if (res?.ok) {
      render(true);
    } else {
      status.textContent = res?.message || "ログインに失敗しました。";
      status.className = "error";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "LOGOUT" }, () => render(false));
});
