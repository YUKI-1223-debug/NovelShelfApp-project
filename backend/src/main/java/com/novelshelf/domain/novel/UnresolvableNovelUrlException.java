package com.novelshelf.domain.novel;

public class UnresolvableNovelUrlException extends RuntimeException {

    public UnresolvableNovelUrlException(String url) {
        super("対応サイトのURLとして認識できませんでした: " + url);
    }
}
