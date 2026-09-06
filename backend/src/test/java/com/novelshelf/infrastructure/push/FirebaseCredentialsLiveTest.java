package com.novelshelf.infrastructure.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * Firebase サービスアカウント JSON が本物で、認証 + プロジェクト解決 + FCM 送信経路が通るかを確認する。
 * {@code -DfirebaseCredentials=<path>} 指定時のみ実行（通常の test タスクからは除外）。
 * 実行例: {@code ./gradlew externalTest -DfirebaseCredentials=/path/to/sa.json}
 */
@Tag("external")
class FirebaseCredentialsLiveTest {

    private static String credentialsPath() {
        String path = System.getProperty("firebaseCredentials");
        assumeTrue(path != null && Files.isReadable(Path.of(path)), "firebaseCredentials 未指定のためスキップ");
        return path;
    }

    @Test
    void serviceAccount_mintsAccessTokenForFcmScope() throws Exception {
        GoogleCredentials credentials;
        try (FileInputStream in = new FileInputStream(credentialsPath())) {
            credentials = GoogleCredentials.fromStream(in)
                    .createScoped(List.of("https://www.googleapis.com/auth/firebase.messaging"));
        }
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();

        assertThat(token).isNotNull();
        assertThat(token.getTokenValue()).isNotBlank();
    }

    @Test
    void firebaseMessaging_resolvesProjectAndReachesFcm() throws Exception {
        GoogleCredentials credentials;
        try (FileInputStream in = new FileInputStream(credentialsPath())) {
            credentials = GoogleCredentials.fromStream(in);
        }
        FirebaseOptions.Builder builder = FirebaseOptions.builder().setCredentials(credentials);
        if (credentials instanceof ServiceAccountCredentials sa && sa.getProjectId() != null) {
            builder.setProjectId(sa.getProjectId());
        }
        FirebaseApp app = FirebaseApp.getApps().stream()
                .filter(a -> "live-test".equals(a.getName()))
                .findFirst()
                .orElseGet(() -> FirebaseApp.initializeApp(builder.build(), "live-test"));

        assertThat(app.getOptions().getProjectId()).as("プロジェクトIDが解決されていること").isNotBlank();

        // それらしい形（が実在しない）トークンへ dry-run 送信。認証・プロジェクト解決が済んでいれば
        // FCM まで到達し「トークンが不正/未登録」で失敗する。プロジェクト未解決なら送信前に落ちる。
        Message message = Message.builder()
                .setToken("fMOCK:APA91b" + "x".repeat(120))
                .putData("type", "credentials-check")
                .build();
        try {
            FirebaseMessaging.getInstance(app).send(message, true);
        } catch (FirebaseMessagingException e) {
            assertThat(e.getMessage())
                    .as("FCM に到達し、トークン起因で失敗するはず。実際: %s", e.getMessage())
                    .containsAnyOf("400", "404", "registration", "not a valid FCM", "INVALID_ARGUMENT", "UNREGISTERED");
        }
    }
}
