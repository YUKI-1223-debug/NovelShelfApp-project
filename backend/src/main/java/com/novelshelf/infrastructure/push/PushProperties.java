package com.novelshelf.infrastructure.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param firebaseCredentials Firebase サービスアカウント JSON のパス。空なら FCM 送信は無効
 *                            （{@link LoggingPushSender} にフォールバックし、ログ出力のみ）。
 * @param updateCheckCron 更新検知ジョブの cron（Asia/Tokyo）。既定は 07:00 / 19:00。
 *                        なろう等へのアクセス頻度を抑えるため1日数回に留めること。
 */
@ConfigurationProperties(prefix = "novelshelf.push")
public record PushProperties(String firebaseCredentials, String updateCheckCron) {

    public PushProperties {
        if (updateCheckCron == null || updateCheckCron.isBlank()) {
            updateCheckCron = "0 0 7,19 * * *";
        }
    }

    public boolean firebaseEnabled() {
        return firebaseCredentials != null && !firebaseCredentials.isBlank();
    }
}
