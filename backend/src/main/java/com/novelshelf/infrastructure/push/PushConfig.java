package com.novelshelf.infrastructure.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.novelshelf.application.push.PushSender;
import java.io.FileInputStream;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * プッシュ配信のブートストラップ。
 * {@code novelshelf.push.firebase-credentials} が指定されていれば FCM 経由（{@link FirebasePushSender}）、
 * 未設定なら {@link LoggingPushSender}（ログ出力のみ）を登録する。
 */
@Configuration
public class PushConfig {

    private static final Logger log = LoggerFactory.getLogger(PushConfig.class);

    @Bean
    @ConditionalOnExpression("!'${novelshelf.push.firebase-credentials:}'.trim().isEmpty()")
    FirebaseMessaging firebaseMessaging(PushProperties properties) throws IOException {
        try (FileInputStream credentials = new FileInputStream(properties.firebaseCredentials())) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(credentials))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(options)
                    : FirebaseApp.getInstance();
            log.info("Firebase Cloud Messaging を初期化しました（project={}）", app.getOptions().getProjectId());
            return FirebaseMessaging.getInstance(app);
        }
    }

    @Bean
    @ConditionalOnBean(FirebaseMessaging.class)
    PushSender firebasePushSender(FirebaseMessaging messaging) {
        return new FirebasePushSender(messaging);
    }

    @Bean
    @ConditionalOnMissingBean(PushSender.class)
    PushSender loggingPushSender() {
        log.info("Firebase 未設定のためプッシュ通知はログ出力のみ（LoggingPushSender）");
        return new LoggingPushSender();
    }
}
