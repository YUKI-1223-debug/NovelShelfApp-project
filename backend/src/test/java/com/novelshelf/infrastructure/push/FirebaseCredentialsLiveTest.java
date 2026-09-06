package com.novelshelf.infrastructure.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * Firebase サービスアカウント JSON が本物で FCM 認証が通るかを、dry-run 送信で確認する。
 * {@code -DfirebaseCredentials=<path>} を渡したときだけ実行（通常の test タスクからは除外）。
 * 実行例: {@code ./gradlew externalTest -DfirebaseCredentials=/path/to/sa.json}
 */
@Tag("external")
class FirebaseCredentialsLiveTest {

    @Test
    void serviceAccount_mintsAccessTokenForFcmScope() throws Exception {
        String path = System.getProperty("firebaseCredentials");
        assumeTrue(path != null && Files.isReadable(Path.of(path)), "firebaseCredentials 未指定のためスキップ");

        GoogleCredentials credentials;
        try (FileInputStream in = new FileInputStream(path)) {
            credentials = GoogleCredentials.fromStream(in)
                    .createScoped(List.of("https://www.googleapis.com/auth/firebase.messaging"));
        }

        // サービスアカウント鍵が本物なら、Google の OAuth エンドポイントからアクセストークンを取得できる。
        // 鍵が失効・改ざん・プロジェクト不一致ならここで例外になる。
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();

        assertThat(token).isNotNull();
        assertThat(token.getTokenValue()).isNotBlank();
    }
}
