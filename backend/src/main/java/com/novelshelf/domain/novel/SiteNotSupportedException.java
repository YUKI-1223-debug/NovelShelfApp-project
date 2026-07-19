package com.novelshelf.domain.novel;

public class SiteNotSupportedException extends RuntimeException {

    private final SiteCode siteCode;

    public SiteNotSupportedException(SiteCode siteCode) {
        super("サイト " + siteCode + " は現在データ取得に対応していません。本棚へのリンク登録のみ可能です。");
        this.siteCode = siteCode;
    }

    public SiteCode getSiteCode() {
        return siteCode;
    }
}
