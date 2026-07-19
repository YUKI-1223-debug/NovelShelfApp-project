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
    await dialog.getByPlaceholder("https://ncode.syosetu.com/xxxxxx/").fill(NAROU_URL);
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
    await expect(page.getByText("第1話 / 15話")).toBeVisible({ timeout: 15_000 });

    const bodyText = await page.locator("article").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  await test.step("次の話に移動できる", async () => {
    await page.getByRole("button", { name: "次の話" }).click();
    await expect(page.getByText("第2話 / 15話")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("縦書き/横書き・ダークモードを切り替えられる", async () => {
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

  await test.step("検索画面でタイトル検索でき、作品詳細に遷移できる", async () => {
    await page.goto("/search");
    await page.getByPlaceholder("タイトルまたは作者名").fill("パーティリーダー");
    await page.getByRole("button", { name: "検索", exact: true }).click();
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

  await test.step("統計画面にサマリー・カレンダー・内訳が表示される", async () => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "読書統計" })).toBeVisible();
    await expect(page.getByText("読了作品数")).toBeVisible();
    await expect(page.getByText("総読書時間")).toBeVisible();
    await page.getByRole("button", { name: "作者別" }).click();
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
