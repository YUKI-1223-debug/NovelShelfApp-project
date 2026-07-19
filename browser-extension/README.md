# NovelShelf ブラウザ拡張（個人利用専用）

なろう・カクヨム・ハーメルンの作品ページを開くと右下に「📚 本棚に追加」ボタンが表示され、クリックすると`https://novelshelf.jp`の本棚に追加されます。

Chromeウェブストア等には公開していません（個人利用専用の未署名拡張）。以下の手順で読み込んでください。

## 対応ブラウザ

- Google Chrome / Microsoft Edge（Manifest V3、`chrome://extensions`から読み込み）
- Android版Chromeは拡張機能自体に非対応です。iOS Safariもこの形式の拡張には対応していません（別途、共有シート経由の`/share`機能をご利用ください）。

## インストール手順（PC限定）

1. Chrome/Edgeで`chrome://extensions`（Edgeは`edge://extensions`）を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このフォルダ（`browser-extension`）を選択する
4. ツールバーに表示されたNovelShelfのアイコンをクリックし、NovelShelfのメールアドレス・パスワードでログインする
5. なろう・カクヨム・ハーメルンの作品ページ（検索結果一覧ではなく、個別の作品ページ）を開くと、右下にボタンが表示される

## 更新したとき

拡張機能側のコード（`background.js`/`content.js`等）を更新した場合は、`chrome://extensions`のNovelShelfカードにある更新（🔄）ボタンを押すか、一度削除して読み込み直してください。

## 仕組み・注意点

- ログイン情報（アクセストークン・リフレッシュトークン）は`chrome.storage.local`にのみ保存され、外部には送信しません。
- 対象URLの判定（作品ページかどうか）は`content.js`側で正規表件を使って行っています。検索結果一覧・作者ページ・トップページ等ではボタンは出ません。
- 実際のAPI呼び出し（ログイン・作品解決・本棚追加）はすべてbackground service worker側で行っています。content scriptはページに直接埋め込まれる関係上、そのページ（例: kakuyomu.jp）のオリジンとしてCORS制限を受けてしまいますが、background側はhost_permissionsで許可したホストへのCORSを迂回できるため、この形にしています。
- `https://novelshelf.jp`のAPIエンドポイントを`background.js`にハードコードしています（個人利用の単一インスタンス運用のため）。
