package com.novelshelf.infrastructure.adapter.kakuyomu;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * カクヨムの実サイトに対する疎通検証。{@code external}タグを付け、既定の{@code ./gradlew test}からは除外している
 * （build.gradle参照）。手動実行: {@code ./gradlew externalTest --tests "*KakuyomuAdapterLiveTest"}
 */
@Tag("external")
class KakuyomuAdapterLiveTest {

    private static final KakuyomuProperties PROPERTIES = new KakuyomuProperties("https://kakuyomu.jp", 1000);
    private final KakuyomuAdapter adapter = new KakuyomuAdapter(PROPERTIES, new KakuyomuRateLimiter(PROPERTIES));

    // 「異修羅」（連載中、前書き・あとがきのない話を含む）
    private static final String KNOWN_WORK_URL = "https://kakuyomu.jp/works/1177354054882641261";
    private static final String KNOWN_WORK_ID = "1177354054882641261";

    @Test
    void resolveNovelReturnsRealMetadata() {
        ExternalNovelMetadata meta = adapter.resolveNovel(KNOWN_WORK_URL);

        assertThat(meta.externalNovelId()).isEqualTo(KNOWN_WORK_ID);
        assertThat(meta.title()).isEqualTo("異修羅");
        assertThat(meta.authorName()).isNotBlank();
        assertThat(meta.authorProfileUrl()).startsWith("https://kakuyomu.jp/users/");
        assertThat(meta.synopsis()).isNotBlank();
        assertThat(meta.totalChapters()).isGreaterThan(0);
    }

    @Test
    void fetchChapterListAndContentReturnRealText() {
        List<ExternalChapter> chapters = adapter.fetchChapterList(KNOWN_WORK_ID);
        assertThat(chapters).isNotEmpty();
        assertThat(chapters.get(0).chapterNo()).isEqualTo(1);
        // なろうと異なり目次ページングの制約がないため、全話数と一致するはず
        assertThat(chapters).hasSize(adapter.resolveNovel(KNOWN_WORK_URL).totalChapters());

        ExternalChapter first = chapters.get(0);
        ExternalChapterContent content = adapter.fetchChapterContent(KNOWN_WORK_ID, first.externalChapterId());
        assertThat(content.title()).isNotBlank();
        assertThat(content.bodyHtml()).contains("<p>");
    }
}
