package com.novelshelf.domain.novel;

public class SiteAccessBlockedException extends RuntimeException {
    public SiteAccessBlockedException(String url, int statusCode) {
        super("サイトへのアクセスが拒否されました(HTTP " + statusCode + ")。サーバーのIPアドレスがサイト側のアクセス制限"
                + "（Bot対策等）に一時的にブロックされている可能性があります。時間をおいて再試行してください: " + url);
    }
}
