const DARK_MODE_KEY = "novelshelf.darkMode";

export function applyTheme(darkMode: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  try {
    window.localStorage.setItem(DARK_MODE_KEY, darkMode ? "1" : "0");
  } catch {
    // localStorageが使えない環境（プライベートブラウズ等）では単にスキップする
  }
}

export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var cached = window.localStorage.getItem("${DARK_MODE_KEY}");
    var dark = cached === null
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : cached === "1";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;
