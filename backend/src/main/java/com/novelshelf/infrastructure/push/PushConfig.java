package com.novelshelf.infrastructure.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.novelshelf.application.push.PushSender;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * プッシュ配信手段の選択。
 * {@code novelshelf.push.firebase-credentials} が指すファイルを読めれば FCM 経由（{@link FirebasePushSender}）、
 * 未設定・ファイル無し・読み込み失敗ならログ出力のみの {@link LoggingPushSender} にフォールバックする
 * （設定不備でアプリが起動しなくなるのを避ける）。
 */
@Configuration
public class PushConfig {

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
        try (FileInputStream credentials = new FileInputStream(credentialsPath.toFile())) {
            GoogleCredentials googleCredentials = GoogleCredentials.fromStream(credentials);
            FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder().setCredentials(googleCredentials);
            // サービスアカウント JSON からプロジェクト ID を明示指定する（自動検出に失敗すると
            // 送信 URL の projects/{id} が null になり送信できないため）。
            if (googleCredentials instanceof ServiceAccountCredentials sa && sa.getProjectId() != null) {
                optionsBuilder.setProjectId(sa.getProjectId());
            }
            FirebaseOptions options = optionsBuilder.build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(options)
                    : FirebaseApp.getInstance();
            log.info("Firebase Cloud Messaging を初期化しました（project={}）", app.getOptions().getProjectId());
            return new FirebasePushSender(FirebaseMessaging.getInstance(app));
        } catch (IOException | RuntimeException e) {
            log.error("Firebase 初期化に失敗しました。プッシュ通知はログ出力のみに切り替えます。", e);
            return new LoggingPushSender();
        }
    }
}
