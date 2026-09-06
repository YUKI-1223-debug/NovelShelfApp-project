package com.novelshelf.infrastructure.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.novelshelf.application.push.PushMessage;
import com.novelshelf.application.push.PushSender;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * FCM HTTP v1 API 経由の配信（Android は FCM、iOS は APNs 中継）。
 * サービスアカウントの OAuth トークンを {@code Authorization: Bearer} で付与し、
 * トークンごとに {@code /v1/projects/{projectId}/messages:send} を呼ぶ。
 */
public class FirebasePushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(FirebasePushSender.class);
    /** アプリ側で作成する通知チャンネル ID（PushNotifications.tsx と一致させること）。 */
    private static final String ANDROID_CHANNEL_ID = "novelshelf-updates";

    private final GoogleCredentials credentials;
    private final String endpoint;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public FirebasePushSender(GoogleCredentials credentials, String projectId) {
        this.credentials = credentials;
        this.endpoint = "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send";
    }

    @Override
    public List<String> send(List<String> tokens, PushMessage message) {
        String bearer;
        try {
            credentials.refreshIfExpired();
            bearer = credentials.getAccessToken().getTokenValue();
        } catch (Exception e) {
            log.error("FCM アクセストークンの取得に失敗しました。送信を中止します。", e);
            return List.of();
        }

        List<String> deadTokens = new ArrayList<>();
        int sent = 0;
        for (String token : tokens) {
            switch (sendOne(bearer, token, message)) {
                case SENT -> sent++;
                case DEAD -> deadTokens.add(token);
                case RETRYABLE -> { /* 次回の定期ジョブで再送 */ }
            }
        }
        if (deadTokens.size() + (tokens.size() - sent - deadTokens.size()) > 0) {
            log.info("FCM 送信: 成功{} / 無効{} / 一時失敗{}",
                    sent, deadTokens.size(), tokens.size() - sent - deadTokens.size());
        }
        return deadTokens;
    }

    private enum Result {
        SENT,
        DEAD,
        RETRYABLE
    }

    private Result sendOne(String bearer, String token, PushMessage message) {
        ObjectNode data = mapper.createObjectNode();
        message.data().forEach(data::put);

        ObjectNode payload = mapper.createObjectNode();
        ObjectNode msg = payload.putObject("message");
        msg.put("token", token);
        msg.putObject("notification").put("title", message.title()).put("body", message.body());
        msg.set("data", data);

        // Android: 高優先度 + ヘッドアップ表示されるチャンネルを指定（既定の fallback チャンネルは
        // 音もヘッドアップも出ず、通知に気づけないため）。
        ObjectNode android = msg.putObject("android");
        android.put("priority", "high");
        android.putObject("notification")
                .put("channel_id", ANDROID_CHANNEL_ID)
                .put("default_sound", true);
        // iOS: バナー + 音。
        msg.putObject("apns").putObject("payload").putObject("aps")
                .put("sound", "default");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + bearer)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .build();

        try {
            HttpResponse<String> res = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200) {
                return Result.SENT;
            }
            String errorStatus = extractErrorStatus(res.body());
            if (res.statusCode() == 404
                    || "UNREGISTERED".equals(errorStatus)
                    || "INVALID_ARGUMENT".equals(errorStatus)) {
                log.info("無効なデバイストークンを削除します（HTTP {} / {}）", res.statusCode(), errorStatus);
                return Result.DEAD;
            }
            log.warn("FCM 送信失敗（HTTP {} / {}）: {}", res.statusCode(), errorStatus, truncate(res.body()));
            return Result.RETRYABLE;
        } catch (Exception e) {
            log.warn("FCM 送信でネットワークエラー: {}", e.toString());
            return Result.RETRYABLE;
        }
    }

    /** FCM のエラー応答から {@code error.status}（"UNREGISTERED" 等）を取り出す。取れなければ null。 */
    private String extractErrorStatus(String body) {
        try {
            JsonNode error = mapper.readTree(body).path("error");
            String status = error.path("status").asString(null);
            if (status != null) {
                return status;
            }
            for (JsonNode detail : error.path("details")) {
                String code = detail.path("errorCode").asString(null);
                if (code != null) {
                    return code;
                }
            }
        } catch (RuntimeException ignored) {
            // 解析不能ならエラーコード不明として扱う
        }
        return null;
    }

    private static String truncate(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
