package com.novelshelf.infrastructure.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.novelshelf.application.push.PushSender;
import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * プッシュ配信手段の選択。
 * {@code novelshelf.push.firebase-credentials} が指すサービスアカウント JSON を読めれば FCM HTTP v1
 * 経由（{@link FirebasePushSender}）、未設定・ファイル無し・読み込み失敗ならログ出力のみの
 * {@link LoggingPushSender} にフォールバックする（設定不備でアプリが起動しなくなるのを避ける）。
 */
@Configuration
public class PushConfig {

    private static final String FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final Logger log = LoggerFactory.getLogger(PushConfig.class);

    @Bean
    PushSender pushSender(PushProperties properties) {
        if (!properties.firebaseEnabled()) {
            log.info("Firebase 未設定のためプッシュ通知はログ出力のみ（LoggingPushSender）");
            return new LoggingPushSender();
        }
        Path credentialsPath = Path.of(properties.firebaseCredentials());
        if (!Files.isReadable(credentialsPath)) {
            log.warn("Firebase 認証情報が読めません（{}）。プッシュ通知はログ出力のみに切り替えます。", credentialsPath);
            return new LoggingPushSender();
        }
        try (FileInputStream in = new FileInputStream(credentialsPath.toFile())) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(in).createScoped(List.of(FCM_SCOPE));
            String projectId = credentials instanceof ServiceAccountCredentials sa ? sa.getProjectId() : null;
            if (projectId == null || projectId.isBlank()) {
                log.warn("サービスアカウント JSON から project_id を取得できません。プッシュ通知はログ出力のみに切り替えます。");
                return new LoggingPushSender();
            }
            log.info("FCM プッシュ通知を有効化しました（project={}）", projectId);
            return new FirebasePushSender(credentials, projectId);
        } catch (Exception e) {
            log.error("Firebase 認証情報の読み込みに失敗しました。プッシュ通知はログ出力のみに切り替えます。", e);
            return new LoggingPushSender();
        }
    }
}
