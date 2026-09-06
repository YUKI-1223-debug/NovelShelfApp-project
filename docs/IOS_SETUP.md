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

### 4. Codemagic を設定
1. https://codemagic.io/ に GitHub アカウントでサインアップ（無料枠 月500分）
2. リポジトリ `YUKI-1223-debug/NovelShelfApp-project` を追加
3. **Teams → Integrations → App Store Connect → Add key**:
   - Name: `novelshelf-appstore`（`codemagic.yaml` の `integrations.app_store_connect` と一致）
   - Issuer ID / Key ID / `.p8` の中身 を貼り付け
4. **App settings → Environment variables**:
   - Group 名: `novelshelf_ios`
   - `APP_STORE_APP_ID` = 手順2でメモした数値 ID（"Secure" オフでよい）
5. `codemagic.yaml` を検出させる（アプリ設定で "Use codemagic.yaml" を選択）

### 5. 最初のビルド
- Codemagic で `ios-testflight` ワークフローを Start build。
- 初回は署名証明書・プロビジョニングプロファイルが自動作成される（`--create`）。
- 成功すると TestFlight に上がる（処理に10〜30分）。

### 6. iPhone にインストール
1. App Store から **TestFlight** アプリを入れる
2. App Store Connect → TestFlight → 内部テスター に自分の Apple ID を追加
   （またはビルドを「自分用」ベータグループに割り当て）
3. iPhone の TestFlight アプリに `NovelShelf` が出る → インストール
4. ログイン → 本棚 → 読書 → 端末間同期（Android と同じ位置から開くか）を確認

---

## フェーズC: iOS のプッシュ通知（フェーズBが動いてから）

iOS はまだプッシュ無効（`PushNotifications.tsx` で android のみに限定）。有効化に必要:

1. **APNs 認証キー**: https://developer.apple.com/account/resources/authkeys/ → ＋ →
   "Apple Push Notifications service (APNs)" にチェック → `.p8` ダウンロード + Key ID メモ
2. **Firebase に iOS アプリを追加**: Firebase コンソール → プロジェクト設定 → アプリを追加 → Apple
   - バンドル ID `jp.novelshelf.app`
   - `GoogleService-Info.plist` をダウンロード → 渡す（`frontend/ios/App/App/` に配置）
3. **Firebase に APNs キーを登録**: プロジェクト設定 → Cloud Messaging → Apple アプリ構成 →
   APNs 認証キーをアップロード（手順1の `.p8` + Key ID + Team ID）
4. こちら側の作業:
   - iOS に Push Notifications capability + `aps-environment` entitlement を追加
   - `AppDelegate` に APNs 登録コールバック + Firebase 初期化を配線
   - iOS でも FCM トークンを取得できるよう Firebase Messaging を組み込み
     （`@capacitor/push-notifications` は iOS では APNs トークンしか返さないため）
   - `PushNotifications.tsx` の対応プラットフォームに `ios` を追加
5. TestFlight ビルドし直し → iPhone で通知許可 → テスト通知で確認

---

## 費用まとめ

| 項目 | 費用 |
|---|---|
| Apple Developer Program | $99/年（≈¥15,000） |
| Codemagic | 無料枠 月500分（個人利用は十分） |
| Firebase (FCM) | 無料 |
