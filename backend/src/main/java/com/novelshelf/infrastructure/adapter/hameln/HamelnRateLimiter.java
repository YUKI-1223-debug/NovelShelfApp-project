package com.novelshelf.infrastructure.adapter.hameln;

import org.springframework.stereotype.Component;

/**
 * syosetu.org（ハーメルン）のrobots.txtは汎用UAへのCrawl-delayを明示していないが、
 * なろう・カクヨムと同様に1秒間隔を自主的に守る。個人利用の1ユーザーが読んでいる話を
 * 都度1件ずつ取得する用途のみを想定し、一括クロールは行わない（docs/DECISIONS.md参照）。
 */
@Component
public class HamelnRateLimiter {

    private final HamelnProperties properties;
    private long lastRequestAtMillis = 0L;

    public HamelnRateLimiter(HamelnProperties properties) {
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
