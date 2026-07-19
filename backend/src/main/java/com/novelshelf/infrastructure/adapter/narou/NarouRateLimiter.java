package com.novelshelf.infrastructure.adapter.narou;

import org.springframework.stereotype.Component;

/**
 * ncode.syosetu.com の robots.txt が指定する Crawl-delay: 1 を遵守するための簡易レートリミッタ。
 * 個人利用の1ユーザーが読んでいる話を都度1件ずつ取得する用途のみを想定しており、
 * 一括クロールは行わない（docs/DECISIONS.md参照）。
 */
@Component
public class NarouRateLimiter {

    private final NarouProperties properties;
    private long lastRequestAtMillis = 0L;

    public NarouRateLimiter(NarouProperties properties) {
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
