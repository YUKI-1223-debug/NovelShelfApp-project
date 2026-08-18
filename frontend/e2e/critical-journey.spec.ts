import { test, expect } from "@playwright/test";

const NAROU_URL = "https://ncode.syosetu.com/n9922ml/";
const NOVEL_TITLE = "パーティリーダーから「田舎に帰れよ」と言われたのでホントに帰ってみた";

function uniqueEmail() {
  return `e2e-${Date.now()}@example.com`;
}

// 1つのページ(=1つのブラウザコンテキスト)を通しで使い、localStorageのログイン状態を
// 各ステップ間で保持する。Playwrightはtestごとに新しいコンテキストを作るため、
// ステップを別testに分割するとログイン状態が失われてしまう。
test("主要な利用導線: サインアップ→作品追加→読書→しおり→設定→削除", async ({ page }) => {
  const email = uniqueEmail();
  const password = "password123";

  await test.step("サインアップすると本棚画面に遷移する", async () => {
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード（8文字以上）").fill(password);
    await page.getByRole("button", { name: "アカウント作成" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "本棚" })).toBeVisible();
  });

  await test.step("なろうのURLから作品を追加できる", async () => {
    await page.getByRole("button", { name: "作品を追加" }).click();

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("URLを貼り付け、または空欄のまま「追加」でコピー済みURLを使用").fill(NAROU_URL);
    await dialog.getByRole("button", { name: "追加" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(NOVEL_TITLE).first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step("作品詳細から読み始め、本文が表示される", async () => {
    await page.getByText(NOVEL_TITLE).first().click();

    await expect(page.getByRole("heading", { name: /パーティリーダー/ })).toBeVisible();
    await expect(page.getByText("話一覧")).toBeVisible();

    await page.getByRole("link", { name: "読み始める" }).click();

    await expect(page).toHaveURL(/\/chapters\//);
    // 総話数は実際のなろう側で作者が更新すると変わりうる（実際に運用中2026-07→2026-08で15→46話に
    // 増えたことが判明）ため、総数は固定せず「第1話であること」だけを検証する。
    await expect(page.getByText(/第1話 \/ \d+話/)).toBeVisible({ timeout: 15_000 });

    const bodyText = await page.locator("article").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  await test.step("次の話に移動できる", async () => {
    await page.getByRole("button", { name: "次の話" }).click();
    await expect(page.getByText(/第2話 \/ \d+話/)).toBeVisible({ timeout: 15_000 });
  });

  await test.step("縦書き/横書き・ダークモードを切り替えられる", async () => {
    // 話送り(次の話)で新しい話に遷移すると、イマーシブ表示(ヘッダー/フッター)が既定の
    // 非表示状態に戻る。本文の中央付近をタップして表示させてからでないとAaボタンを
    // 操作できない。
    await page.locator("article").click();
    await page.getByRole("button", { name: "Aa" }).click();
    await expect(page.getByRole("button", { name: "縦書き" })).toBeVisible();

    await page.getByRole("button", { name: "縦書き" }).click();
    await expect(page.getByRole("button", { name: "横書き" })).toBeVisible();

    await page.getByRole("button", { name: "ダークモード" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  await test.step("しおりを追加できる", async () => {
    await page.getByRole("button", { name: "しおりを追加" }).click();

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/名前/).fill("E2Eテストしおり");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/bookmarks");
    await expect(page.getByText("E2Eテストしおり")).toBeVisible();
  });

  await test.step("本棚画面で小説名検索フィルターができ、作品詳細に遷移できる", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "小説名で検索" }).click();
    await page.getByPlaceholder("小説名で絞り込み").fill("パーティリーダー");
    await expect(page.getByText(NOVEL_TITLE).first()).toBeVisible({ timeout: 15_000 });

    await page.getByText(NOVEL_TITLE).first().click();
    await expect(page).toHaveURL(/\/novels\//);
  });

  await test.step("作者ページに遷移し、作品数・読了数が表示される", async () => {
    await page.getByRole("link", { name: "奥州寛" }).click();
    await expect(page).toHaveURL(/\/authors\//);
    await expect(page.getByRole("heading", { name: "奥州寛" })).toBeVisible();
    await expect(page.getByText("全作品")).toBeVisible();
    await expect(page.getByText("お気に入り")).toBeVisible();
  });

  await test.step("更新一覧画面が表示され、更新確認をリクエストできる", async () => {
    await page.goto("/updates");
    await expect(page.getByRole("heading", { name: "更新一覧" })).toBeVisible();
    await page.getByRole("button", { name: "更新を確認" }).click();
    await expect(page.getByText(/更新確認をリクエストしました|失敗しました/)).toBeVisible({ timeout: 10_000 });
  });

  await test.step("設定画面でフォント設定を変更でき、リロード後も保持される", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();

    await page.getByRole("button", { name: "ゴシック" }).click();
    await page.waitForTimeout(500); // PUT /settings の反映待ち

    await page.reload();
    await expect(page.getByRole("button", { name: "ゴシック" })).toHaveClass(/border-accent/);
  });

  await test.step("本棚から作品を削除できる", async () => {
    await page.goto("/");
    await page.getByText(NOVEL_TITLE).first().click();
    await page.getByRole("button", { name: "本棚から削除" }).click();

    await expect(page.getByRole("button", { name: "本棚に追加" })).toBeVisible();
  });
});
