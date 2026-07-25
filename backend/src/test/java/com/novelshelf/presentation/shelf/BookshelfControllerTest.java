package com.novelshelf.presentation.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.novelshelf.application.novel.NovelQueryService;
import com.novelshelf.application.reading.ReadingService;
import com.novelshelf.application.shelf.BookshelfService;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.shelf.BookshelfEntry;
import com.novelshelf.domain.shelf.ShelfStatus;
import com.novelshelf.presentation.novel.NovelResponse;
import com.novelshelf.presentation.novel.NovelResponseMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BookshelfControllerTest {

    @Mock
    private BookshelfService bookshelfService;

    @Mock
    private NovelQueryService novelQueryService;

    @Mock
    private NovelResponseMapper novelResponseMapper;

    @Mock
    private ReadingService readingService;

    private BookshelfEntry entry(String title, Instant addedAt) {
        UUID novelId = UUID.randomUUID();
        Novel novel = Novel.builder()
                .id(novelId)
                .title(title)
                .sourceUrl("https://ncode.syosetu.com/n0000aa/")
                .status(NovelStatus.ONGOING)
                .build();
        when(novelQueryService.getById(novelId)).thenReturn(novel);
        when(novelResponseMapper.toResponse(novel, null))
                .thenReturn(new NovelResponse(
                        novelId, title, "作者", null, true, null, null, novel.getSourceUrl(),
                        NovelStatus.ONGOING, 0, false, null));
        return BookshelfEntry.builder()
                .id(UUID.randomUUID())
                .userId(null)
                .novelId(novelId)
                .status(ShelfStatus.READING)
                .addedAt(addedAt)
                .build();
    }

    // 「追加順」(sort/groupBy未指定)で最後に追加した作品が一番上に来ない不具合の回帰テスト(⑤)。
    // 修正前はDBフェッチ結果の並びをそのまま返しており、addedAt降順が保証されていなかった。
    @Test
    void list_defaultOrder_isAddedAtDescending() {
        Instant now = Instant.now();
        BookshelfEntry oldest = entry("最初に追加した作品", now.minus(2, ChronoUnit.DAYS));
        BookshelfEntry newest = entry("最後に追加した作品", now);
        BookshelfEntry middle = entry("2番目に追加した作品", now.minus(1, ChronoUnit.DAYS));

        // リポジトリのフェッチ順は保証されないため、意図的に追加順とは異なる並びで返す。
        when(bookshelfService.list(null, null, null)).thenReturn(List.of(oldest, newest, middle));
        when(readingService.lastReadAtByNovelIds(any(), any())).thenReturn(Map.of());

        BookshelfController controller =
                new BookshelfController(bookshelfService, novelQueryService, novelResponseMapper, readingService);

        List<BookshelfEntryResponse> result = controller.list(null, null, null, null, null);

        assertThat(result).extracting(r -> r.novel().title())
                .containsExactly("最後に追加した作品", "2番目に追加した作品", "最初に追加した作品");
    }
}
