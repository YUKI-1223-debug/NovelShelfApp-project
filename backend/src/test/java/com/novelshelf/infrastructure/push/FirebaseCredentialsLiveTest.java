package com.novelshelf.infrastructure.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import java.io.FileInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * Firebase サービスアカウント JSON が本物で、FCM HTTP v1 に認証付きで到達できるかを確認する。
 * {@code -DfirebaseCredentials=<path>} 指定時のみ実行（通常の test タスクからは除外）。
 * 実トークンへ本当に送りたい場合は {@code -DfcmToken=<token>} も渡す。
 * 実行例: {@code ./gradlew externalTest -DfirebaseCredentials=/path/to/sa.json}
 */
@Tag("external")
class FirebaseCredentialsLiveTest {

    private static final String FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

    private static String credentialsPath() {
        String path = System.getProperty("firebaseCredentials");
        assumeTrue(path != null && Files.isReadable(Path.of(path)), "firebaseCredentials 未指定のためスキップ");
        return path;
    }

    private static ServiceAccountCredentials load() throws Exception {
        try (FileInputStream in = new FileInputStream(credentialsPath())) {
            return (ServiceAccountCredentials)
                    GoogleCredentials.fromStream(in).createScoped(List.of(FCM_SCOPE));
        }
    }

    @Test
    void serviceAccount_mintsAccessTokenForFcmScope() throws Exception {
        ServiceAccountCredentials credentials = load();
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();

        assertThat(token).isNotNull();
        assertThat(token.getTokenValue()).isNotBlank();
        assertThat(credentials.getProjectId()).isNotBlank();
    }

    @Test
    void fcmV1_acceptsAuthenticatedRequest() throws Exception {
        ServiceAccountCredentials credentials = load();
        credentials.refresh();
        String bearer = credentials.getAccessToken().getTokenValue();
        String projectId = credentials.getProjectId();

        String token = System.getProperty("fcmToken", "MOCK_TOKEN_FOR_VALIDATION_ONLY");
        String body = """
            {"message":{"token":"%s",\
            "notification":{"title":"NovelShelf","body":"疎通確認"},\
            "android":{"priority":"high","notification":{"channel_id":"novelshelf-updates","default_sound":true}},\
            "data":{"type":"test"}}}
            """.formatted(token);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send"))
                .header("Authorization", "Bearer " + bearer)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> res = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        // 実トークン未指定なら「トークンが不正」で 400/404（＝認証は通っている）。
        // 実トークン指定なら 200（実際に通知が飛ぶ）。401/403 は認証・権限の問題。
        assertThat(res.statusCode())
                .as("認証は通るはず。実際: %d / %s", res.statusCode(), res.body())
                .isIn(200, 400, 404);
    }
}
