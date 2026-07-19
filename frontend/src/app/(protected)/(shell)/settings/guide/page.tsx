import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border px-4 py-5 last:border-b-0">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function UserGuidePage() {
  return (
    <div className="flex flex-col gap-2 pt-6 pb-10">
      <div className="flex items-center gap-2 px-4">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-muted">
          <ChevronLeftIcon className="h-4 w-4" /> 設定
        </Link>
      </div>
      <h1 className="px-4 text-xl font-bold">使い方ガイド</h1>

      <div className="flex flex-col">
        <Section title="作品を追加する">
          <p>本棚画面右上の「＋」ボタンから「作品を追加」ダイアログを開き、以下のいずれかの方法で追加できます。</p>
          <ul className="list-disc pl-5">
            <li>作品ページのURLを直接貼り付けて「追加」を押す。</li>
            <li>
              ダイアログ内の「なろう」「なろう(R18)」「カクヨム」「ハーメルン」ボタンで各サイトの検索ページを新しいタブで開き、目的の作品ページでURLをコピーする。ダイアログに戻り、URL欄を
              <strong className="text-foreground">空欄のまま</strong>「追加」を押すと、コピーしたURLを自動で読み取って追加します（対応ブラウザのみ。読み取れない場合は手動で貼り付けてください）。
            </li>
            <li>
              Android/PCでは、なろう・カクヨム・ハーメルンの作品ページを開いた状態で端末標準の共有ボタンからNovelShelfを選ぶと直接追加できます（ホーム画面にインストール済みであることが必要）。iPhone/iPadで同様のことをするには、設定画面の案内に従って一度だけiOSショートカットを作成してください。
            </li>
            <li>
              PCではブラウザ拡張機能（Chrome/Edge）を使うと、なろう・カクヨム・ハーメルンの作品ページに表示される「本棚に追加」ボタンから直接追加できます。導入方法はリポジトリの<code className="rounded bg-card px-1 py-0.5 text-xs">browser-extension/README.md</code>を参照してください。
            </li>
          </ul>
          <p>
            なろう・カクヨム・ハーメルン以外のURL（pixiv小説など）はタイトル・作者などを自動取得できないため、リンク登録のみになります。作品詳細画面の鉛筆アイコンからタイトルを手動で編集できます。
          </p>
        </Section>

        <Section title="読書画面の操作">
          <ul className="list-disc pl-5">
            <li>本文をタップするとヘッダー・フッターの表示/非表示を切り替えられます（没入表示）。</li>
            <li>
              設定の「ページ送り」で表示方式を切り替えられます。「スクロール」は連続スクロール、「ページ送り」は画面ぴったりの1ページ単位でタップしてめくる方式です（左右タップで前後のページ、中央タップで表示切替）。現在ページ送りは横書きのみ対応しており、縦書きは常にスクロール表示になります。
            </li>
            <li>フッターの「次の話」「前の話」で話を移動できます。スクロールモードでは本文の最後までスクロールすると自動で次の話に移動します。</li>
            <li>フッターの「しおりを追加」で、今の読書位置にしおりを保存できます。しおり一覧はフッターナビの「しおり」から確認できます。</li>
            <li>設定はヘッダーの「Aa」ボタンから、書字方向（縦書き/横書き）・フォント・文字サイズ・ダークモードをその場で変更できます。</li>
          </ul>
        </Section>

        <Section title="オフラインで読む">
          <p>
            通常は開いた話を1話ずつ自動でキャッシュし、電波が無い状態でも直前まで読んでいた話を開けます。作品全体を事前にまとめて保存したい場合は、作品詳細画面の「全話をオフライン保存」を使ってください（話数が多い作品は数分かかることがあります）。
          </p>
        </Section>

        <Section title="検索・タグ・お気に入り">
          <ul className="list-disc pl-5">
            <li>フッターナビの「検索」から、タイトル・作者名・サイト・ジャンル・タグで本棚内の作品を絞り込めます。</li>
            <li>作品詳細画面でタグを自由に追加・削除できます。</li>
            <li>本棚の各作品行のハートアイコンでお気に入り登録できます。</li>
          </ul>
        </Section>

        <Section title="読書統計">
          <p>フッターナビの読書統計アイコン（グラフ）から、日々の読書時間や読了状況のカレンダーを確認できます。</p>
        </Section>
      </div>
    </div>
  );
}
