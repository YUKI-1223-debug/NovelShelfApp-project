package com.novelshelf.infrastructure.adapter.kakuyomu;

import org.springframework.stereotype.Component;

/**
 * kakuyomu.jpのrobots.txtは汎用UAへのCrawl-delayを明示していないが、
 * {@code ClaudeBot}向けにCrawl-delay: 1が明示されている。それに準じて1秒間隔を自主的に守る。
 * ナローと同様、個人利用の1ユーザーが読んでいる話を都度1件ずつ取得する用途のみを想定する
 * （docs/DECISIONS.md参照）。
 */
@Component
public class KakuyomuRateLimiter {

    private final KakuyomuProperties properties;
    private long lastRequestAtMillis = 0L;

    public KakuyomuRateLimiter(KakuyomuProperties properties) {
        this.properties = properties;
    }

    public synchronized void throttle() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRequestAtMillis;
        long waitMillis = properties.requestIntervalMs() - elapsed;
        if (waitMillis > 0) {
            try {
                Thread.sleep(waitMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastRequestAtMillis = System.currentTimeMillis();
    }
}
