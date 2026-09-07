# iOS ビルド・配布（Codemagic → TestFlight）

Windows 開発機 + クラウド Mac ビルド（Codemagic）+ TestFlight 配布の手順。
Mac は不要。Apple Developer Program（$99/年）加入が前提。

## 全体像

```
GitHub push → Codemagic(クラウド Mac) → npm ci → web ビルド → cap sync ios
           → 署名(App Store Connect API キー) → xcodebuild → .ipa
           → TestFlight アップロード → iPhone の TestFlight アプリでインストール
```

コミット済み: `codemagic.yaml`（ビルド定義）、`frontend/ios/`（Xcode プロジェクト）。

---

## フェーズB: iOS アプリを iPhone で動かす（プッシュなし）

### 1. Apple Developer Program に加入
- https://developer.apple.com/programs/enroll/ から個人アカウントで加入（$99/年）。
- 支払い後、有効化まで数分〜最大48時間。

### 2. App Store Connect にアプリを登録
1. https://appstoreconnect.apple.com/ → マイ App → ＋ → 新規 App
2. プラットフォーム: iOS / 名前: `NovelShelf` / 主言語: 日本語
3. バンドル ID: `jp.novelshelf.app`
   - 一覧に無ければ https://developer.apple.com/account/resources/identifiers/ で
     Identifier を新規作成（Explicit、`jp.novelshelf.app`）してから戻る
4. SKU: 任意（例 `novelshelf`）
5. 作成後、**アプリの数値 ID（App Store Connect の URL の `/app/` の後ろの数字）をメモ** → 後で使う

### 3. App Store Connect API キーを発行
1. https://appstoreconnect.apple.com/access/integrations/api → チーム キー → ＋
2. 名前: `codemagic` / アクセス: **App Manager**
3. 生成 → **`.p8` ファイルをダウンロード**（1回だけ）+ **Key ID** と **Issuer ID** をメモ

（2026-09-06 実績: Key ID `TL4KRXDVV3` / Issuer `6ba00ea2-c326-498e-8dd6-e9cbf2a70fd4` / Team ID `28Q7PP2X98`）

### 4. Codemagic を設定
1. https://codemagic.io/ に GitHub アカウントでサインアップ（無料枠 月500分）
2. **GitHub App を接続**: `github.com/settings/installations` の Codemagic CI/CD で
   `NovelShelfApp-project` へのリポジトリアクセスを許可（ここが未設定だと Codemagic の
   "Install GitHub App" ボタンが無反応のまま止まる）。
3. Add application → `NovelShelfApp-project` → project type iOS → "Use codemagic.yaml"。
4. **右上アカウント名 → Teams → Personal Account → Integrations → Developer Portal → Connect**:
   - **Name: `novelshelf-appstore`**（`codemagic.yaml` の `integrations.app_store_connect` と完全一致）
   - Issuer ID / Key ID / `.p8` の中身 を貼り付け
   - ※`APP_STORE_APP_ID` は `codemagic.yaml` に直書き済みのため環境変数グループは不要。

### 5. コード署名ファイルを用意（重要・自動では作られない）

`environment.ios_signing`（自動コード署名）を使っているが、**プロビジョニングプロファイルの
新規作成まではやってくれない**。証明書の秘密鍵も Apple からは取得できない。初回だけ手動で用意する:

1. **配布証明書を Codemagic で生成**（秘密鍵ごと Codemagic に保存される）:
   Settings → **Code signing identities** → **iOS certificates** → **Generate certificate**
   - Reference name: `novelshelf-dist`
   - App Store Connect API key: `novelshelf-appstore`
   - Type: **Apple Distribution**
2. **App Store プロファイルを Apple Developer Portal で手動作成**:
   https://developer.apple.com/account/resources/profiles/list → ＋ →
   **Distribution → App Store Connect** → App ID `jp.novelshelf.app` →
   証明書 = 手順1の Distribution 証明書 → 名前 `NovelShelf App Store` → Generate
3. **Codemagic に取り込む**: Code signing identities → **iOS provisioning profiles** →
   **Fetch profiles**（API key `novelshelf-appstore`）→ `NovelShelf App Store` を
   reference name `novelshelf_appstore` で Download。

（証明書の有効期限は生成から1年。切れたら手順1〜3をやり直す）

### 6. 最初のビルド
- Codemagic で `ios-testflight` ワークフローを Start build（branch `main`）。
- 初回は Swift Package コンパイルで時間がかかる（10〜20分）。
- 成功すると TestFlight に上がる（App Store Connect 側の処理に更に10〜30分）。

### 6. iPhone にインストール
1. App Store から **TestFlight** アプリを入れる
2. App Store Connect → TestFlight → 内部テスター に自分の Apple ID を追加
   （またはビルドを「自分用」ベータグループに割り当て）
3. iPhone の TestFlight アプリに `NovelShelf` が出る → インストール
4. ログイン → 本棚 → 読書 → 端末間同期（Android と同じ位置から開くか）を確認

---

## フェーズC: iOS のプッシュ通知（フェーズBが動いてから）

iOS はまだプッシュ無効（`PushNotifications.tsx` で android のみに限定）。有効化に必要:

1. **APNs 認証キー** — ✅ 完了（2026-09-07）: Name `NovelShelf APNs` / **Key ID `FZ3Z9S2384`** /
   Environment `Sandbox & Production` / `Team Scoped (All Topics)`。`.p8` =
   `WorkSpace/NovelShelf-secrets/AuthKey_FZ3Z9S2384.p8`。Team ID `28Q7PP2X98`。
   （作成手順: https://developer.apple.com/account/resources/authkeys/ → ＋ →
   "Apple Push Notifications service (APNs)" → Configure で環境/種別を設定 → `.p8` ダウンロード（1回のみ））
2. **Firebase に iOS アプリを追加** — ✅ 完了（2026-09-07）: project `novelshelf-6520c` /
   バンドル ID `jp.novelshelf.app` / App Store ID `6809167553`。`GoogleService-Info.plist` は
   `WorkSpace/NovelShelf-secrets/` に保管し、Codemagic の secure 環境変数
   `GOOGLE_SERVICE_INFO_PLIST_B64`（group `firebase`、base64）にも登録済み。
   ビルド時に `codemagic.yaml` のステップで `frontend/ios/App/App/GoogleService-Info.plist` へデコード。
3. **Firebase に APNs キーを登録** — ✅ 完了（2026-09-07）: iOS アプリの Cloud Messaging →
   Apple アプリの構成 → APNs 認証キー = `.p8`（`FZ3Z9S2384`）+ Key ID + Team ID `28Q7PP2X98`。
4. こちら側の作業 — ✅ 完了（2026-09-07、コミット）:
   - プッシュプラグインを **`@capacitor/push-notifications` → `@capacitor-firebase/messaging`（両 OS）** に載せ替え
     （iOS の `@capacitor/push-notifications` は APNs トークンしか返さず、バックエンドは FCM 前提のため）。
   - `App.entitlements`（`aps-environment=production`）+ `CODE_SIGN_ENTITLEMENTS` を pbxproj に設定。
   - `AppDelegate` に APNs 橋渡し3メソッド。`FirebaseApp.configure()` はプラグインが自前で呼ぶ。
   - `PushNotifications.tsx` を `FirebaseMessaging` API で書き直し、対応プラットフォームに `ios` 追加。
   - Android は release ビルド成功をローカル確認（versionCode 3 / 1.0.2）。
5. **残（要ユーザー）**:
   - **App ID `jp.novelshelf.app` に Push Notifications capability を追加**（Identifiers → 対象 → Push Notifications → Save）
   - **`NovelShelf App Store` プロビジョニングプロファイルを作り直す**（Profiles → Edit → 証明書 `novelshelf-dist` →
     Save → Download → secrets を上書き → Codemagic の Code signing identities → iOS provisioning profiles で Fetch/Upload）
   - Codemagic で **Start new build**（branch `main`）→ TestFlight → iPhone で通知許可 → 設定「テスト通知を送る」で確認
   - ⚠️ SPM に firebase-ios-sdk（大）が加わるので初回ビルドは時間がかかる。失敗時はログの SPM 解決 / 署名まわりを確認。

---

## 費用まとめ

| 項目 | 費用 |
|---|---|
| Apple Developer Program | $99/年（≈¥15,000） |
| Codemagic | 無料枠 月500分（個人利用は十分） |
| Firebase (FCM) | 無料 |
