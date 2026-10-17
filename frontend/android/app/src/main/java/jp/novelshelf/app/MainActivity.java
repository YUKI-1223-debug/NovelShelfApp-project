package jp.novelshelf.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * 共有シート(ACTION_SEND / text/plain)で受け取った文字列を {@code novelshelf://share?text=...} の
 * ACTION_VIEW に置き換えてから Capacitor に渡す(個人利用アプリ化 S2-7)。
 *
 * <p>Capacitor の App プラグインは ACTION_VIEW の URL を {@code appUrlOpen} イベント(起動中)と
 * {@code getLaunchUrl()}(この共有でアプリが起動したとき)で画面側に渡すので、画面側は iOS の
 * Share Extension と同じ処理(components/CapacitorBridge.tsx → /share)で受け取れる。
 * PWA の share_target は WebView 版のアプリでは使えないため、その代わり。
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        rewriteShareIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        rewriteShareIntent(intent);
        super.onNewIntent(intent);
    }

    private static void rewriteShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) {
            return;
        }
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null || text.length() == 0) {
            return;
        }
        Uri uri = new Uri.Builder()
                .scheme("novelshelf")
                .authority("share")
                .appendQueryParameter("text", text.toString())
                .build();
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(uri);
    }
}
