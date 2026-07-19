package com.novelshelf.domain.novel;

public class ContentNotAvailableException extends RuntimeException {
    public ContentNotAvailableException(SiteCode siteCode) {
        super("サイト " + siteCode + " は規約上、本文の自動取得に対応していません。外部リンクから閲覧してください。");
    }
}
