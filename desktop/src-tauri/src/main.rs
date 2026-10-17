// リリースビルドではコンソールウィンドウを出さない(AI秘書の desktop と同じ。指定しないと本体が
// コンソールサブシステムのバイナリになり、起動時にコマンドプロンプトがもう一つ開く)。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// NovelShelf の Windows デスクトップアプリ(個人利用アプリ化 S2-5)。
// 画面は frontend の静的エクスポート(out/)をそのまま同梱する。API はミニPCの tailnet 入口
// (https://minipc.tail0347f4.ts.net:8445)へ tauri-plugin-http 経由で送る(WebView の CORS の対象外)。
// JavaSilver の desktop/(AI秘書の desktop/ が元)を雛形にし、トレイ常駐・自動起動・サイドカーは外した。

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        // ウィンドウの位置と大きさを覚えて、次の起動で戻す
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
