package com.novelshelf.infrastructure.adapter;

import java.time.Instant;

public record ExternalChapter(
        String externalChapterId,
        int chapterNo,
        String title,
        // サイト側で話が「章」単位にグループ分けされている場合の章題。章分けが無い作品・サイトではnull。
        String arcTitle,
        String sourceUrl,
        Instant publishedAt) {}
