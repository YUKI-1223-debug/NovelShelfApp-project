package com.novelshelf.infrastructure.adapter.narou;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * なろうの実サイト・実APIに対する疎通検証。
 *
 * <p>{@code external}タグを付け、既定の{@code ./gradlew test}からは除外している（build.gradle参照）。
 * なろう側のページ構造変更（HTML取得の破綻）を検知する目的のテストなので、サイトへの不要な負荷を避けるため
 * 通常のCI/コミット毎には実行せず、リリース前など必要なタイミングで手動実行する:
 * {@code ./gradlew test --tests "*NarouAdapterLiveTest" -DincludeExternalTests=true}
 */
@Tag("external")
class NarouAdapterLiveTest {

    private static final NarouProperties PROPERTIES =
            new NarouProperties("https://api.syosetu.com/novelapi/api/", "https://ncode.syosetu.com", 1000);
    private final NarouAdapter adapter = new NarouAdapter(PROPERTIES, new NarouRateLimiter(PROPERTIES));

    private static final String KNOWN_NOVEL_URL = "https://ncode.syosetu.com/n9922ml/";

    @Test
    void resolveNovelReturnsRealMetadata() {
        ExternalNovelMetadata meta = adapter.resolveNovel(KNOWN_NOVEL_URL);

        assertThat(meta.externalNovelId()).isEqualTo("n9922ml");
        assertThat(meta.title()).isNotBlank();
        assertThat(meta.authorName()).isNotBlank();
        assertThat(meta.totalChapters()).isGreaterThan(0);
    }

    @Test
    void fetchChapterListAndContentReturnRealText() {
        List<ExternalChapter> chapters = adapter.fetchChapterList("n9922ml");
        assertThat(chapters).isNotEmpty();

        ExternalChapter first = chapters.get(0);
        assertThat(first.chapterNo()).isEqualTo(1);

        ExternalChapterContent content = adapter.fetchChapterContent("n9922ml", first.externalChapterId());
        assertThat(content.title()).isNotBlank();
        assertThat(content.bodyHtml()).contains("<p>");
    }
}
