package com.novelshelf.infrastructure.adapter.hameln;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * ハーメルンの実サイトに対する疎通検証。{@code external}タグを付け、既定の{@code ./gradlew test}からは除外している
 * （build.gradle参照）。手動実行: {@code ./gradlew externalTest --tests "*HamelnAdapterLiveTest"}
 */
@Tag("external")
class HamelnAdapterLiveTest {

    private static final HamelnProperties PROPERTIES = new HamelnProperties("https://syosetu.org", 1000);
    private final HamelnAdapter adapter = new HamelnAdapter(PROPERTIES, new HamelnRateLimiter(PROPERTIES));

    // 「強欲の旅人は神の恩恵を受けない」（前書き・あとがきの両方がある話を含む）
    private static final String KNOWN_NOVEL_URL = "https://syosetu.org/novel/417556/";
    private static final String KNOWN_NOVEL_ID = "417556";

    @Test
    void resolveNovelReturnsRealMetadata() {
        ExternalNovelMetadata meta = adapter.resolveNovel(KNOWN_NOVEL_URL);

        assertThat(meta.externalNovelId()).isEqualTo(KNOWN_NOVEL_ID);
        assertThat(meta.title()).isEqualTo("強欲の旅人は神の恩恵を受けない");
        assertThat(meta.authorName()).isNotBlank();
        assertThat(meta.authorProfileUrl()).contains("/user/");
        assertThat(meta.synopsis()).isNotBlank();
        assertThat(meta.totalChapters()).isGreaterThan(0);
    }

    @Test
    void fetchChapterListAndContentExcludesPrefaceAndAfterword() {
        List<ExternalChapter> chapters = adapter.fetchChapterList(KNOWN_NOVEL_ID);
        assertThat(chapters).isNotEmpty();
        assertThat(chapters.get(0).chapterNo()).isEqualTo(1);

        // 第1話には前書き(maegaki)・あとがき(atogaki)の両方があるため、本文(honbun)のみが
        // 取れているか(前書きの短い文言だけになっていないか)を回帰確認する。
        ExternalChapter first = chapters.get(0);
        ExternalChapterContent content = adapter.fetchChapterContent(KNOWN_NOVEL_ID, first.externalChapterId());
        assertThat(content.title()).isNotBlank();
        assertThat(content.bodyHtml()).contains("<p>");
        assertThat(content.bodyHtml().length()).isGreaterThan(3000);
    }
}
