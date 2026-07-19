package com.novelshelf.application.novel;

import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * 「更新あり」はユーザー操作ではなく、最新話数と最後に読んだ話数の差分から導出する（docs/DECISIONS.md参照）。
 */
@Component
public class NovelUpdateChecker {

    private final ReadingPositionRepository readingPositionRepository;

    public NovelUpdateChecker(ReadingPositionRepository readingPositionRepository) {
        this.readingPositionRepository = readingPositionRepository;
    }

    public boolean hasUpdate(UUID userId, Novel novel) {
        return readingPositionRepository
                .findByUserIdAndNovelId(userId, novel.getId())
                .map(p -> novel.getLatestKnownChapterNo() > p.getLastReadChapterNo())
                .orElse(false);
    }
}
