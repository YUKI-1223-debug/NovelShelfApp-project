package com.novelshelf.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.TestcontainersConfiguration;
import com.novelshelf.domain.novel.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * 本棚・タグ・しおり・読書位置/履歴・統計・オフライン設定のend-to-end検証。
 * 外部サイト（なろう）への実アクセスは行わず、リポジトリで直接テストデータを準備する
 * （NarouAdapter自体の実データ検証はNarouAdapterLiveTestで別途行う）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration.class)
class ShelfBookmarkIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private NovelRepository novelRepository;

    @Autowired
    private ChapterRepository chapterRepository;

    private String accessToken;
    private UUID novelId;
    private UUID chapterId;

    @BeforeEach
    void setUp() {
        String email = "test-" + System.nanoTime() + "@example.com";
        ResponseEntity<Map> signup = restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);
        accessToken = (String) signup.getBody().get("accessToken");

        Site narou = siteRepository.findByCode(SiteCode.NAROU).orElseThrow();
        Author author = authorRepository.save(Author.builder()
                .siteId(narou.getId())
                .externalAuthorId("test-author-" + System.nanoTime())
                .name("テスト作者")
                .build());
        Novel novel = novelRepository.save(Novel.builder()
                .siteId(narou.getId())
                .authorId(author.getId())
                .externalNovelId("ntest" + System.nanoTime())
                .title("テスト小説")
                .synopsis("あらすじ")
                .sourceUrl("https://ncode.syosetu.com/ntest/")
                .status(NovelStatus.ONGOING)
                .latestKnownChapterNo(3)
                .build());
        novelId = novel.getId();

        Chapter chapter = chapterRepository.save(Chapter.builder()
                .novelId(novelId)
                .externalChapterId("1")
                .chapterNo(1)
                .title("第一話")
                .sourceUrl("https://ncode.syosetu.com/ntest/1/")
                .publishedAt(Instant.now())
                .build());
        chapterId = chapter.getId();
    }

    private HttpEntity<Object> auth(Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        return new HttpEntity<>(body, headers);
    }

    @Test
    void bookshelfLifecycle() {
        ResponseEntity<Map> add = restTemplate.exchange(
                "/api/v1/shelf", HttpMethod.POST, auth(Map.of("novelId", novelId.toString(), "status", "READING")), Map.class);
        assertThat(add.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String entryId = (String) add.getBody().get("id");

        ResponseEntity<List> list =
                restTemplate.exchange("/api/v1/shelf", HttpMethod.GET, auth(null), List.class);
        assertThat(list.getBody()).hasSize(1);

        ResponseEntity<Map> tag = restTemplate.exchange(
                "/api/v1/tags", HttpMethod.POST, auth(Map.of("name", "神作品")), Map.class);
        String tagId = (String) tag.getBody().get("id");

        ResponseEntity<Map> patch = restTemplate.exchange(
                "/api/v1/shelf/" + entryId,
                HttpMethod.PATCH,
                auth(Map.of("isFavorite", true, "tagIds", List.of(tagId))),
                Map.class);
        assertThat(patch.getBody().get("isFavorite")).isEqualTo(true);
        assertThat((List) patch.getBody().get("tags")).hasSize(1);

        ResponseEntity<Void> delete =
                restTemplate.exchange("/api/v1/shelf/" + entryId, HttpMethod.DELETE, auth(null), Void.class);
        assertThat(delete.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void readingPositionAndHistoryAndStats() {
        ResponseEntity<Map> put = restTemplate.exchange(
                "/api/v1/reading/positions/" + novelId,
                HttpMethod.PUT,
                auth(Map.of("chapterId", chapterId.toString(), "scrollPosition", 42.5)),
                Map.class);
        assertThat(put.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<Map> get = restTemplate.exchange(
                "/api/v1/reading/positions/" + novelId, HttpMethod.GET, auth(null), Map.class);
        assertThat(((Number) get.getBody().get("scrollPosition")).doubleValue()).isEqualTo(42.5);

        ResponseEntity<Void> history = restTemplate.exchange(
                "/api/v1/reading/history",
                HttpMethod.POST,
                auth(Map.of(
                        "chapterId", chapterId.toString(),
                        "readAt", Instant.now().toString(),
                        "durationSeconds", 300)),
                Void.class);
        assertThat(history.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<Map> summary =
                restTemplate.exchange("/api/v1/stats/summary", HttpMethod.GET, auth(null), Map.class);
        assertThat(((Number) summary.getBody().get("totalReadingSeconds")).longValue()).isEqualTo(300L);
    }

    @Test
    void bookmarkLifecycleIncludesNovelNavigationFields() {
        ResponseEntity<Map> create = restTemplate.exchange(
                "/api/v1/bookmarks",
                HttpMethod.POST,
                auth(Map.of("chapterId", chapterId.toString(), "name", "しおり1", "memo", "メモ")),
                Map.class);
        assertThat(create.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(create.getBody().get("novelId")).isEqualTo(novelId.toString());
        assertThat(create.getBody().get("chapterNo")).isEqualTo(1);

        ResponseEntity<List> list =
                restTemplate.exchange("/api/v1/bookmarks", HttpMethod.GET, auth(null), List.class);
        assertThat(list.getBody()).hasSize(1);
    }

    @Test
    void offlinePreferenceLifecycle() {
        ResponseEntity<Map> add = restTemplate.exchange(
                "/api/v1/offline/preferences", HttpMethod.POST, auth(Map.of("chapterId", chapterId.toString())), Map.class);
        assertThat(add.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<List> list =
                restTemplate.exchange("/api/v1/offline/preferences", HttpMethod.GET, auth(null), List.class);
        assertThat(list.getBody()).hasSize(1);

        ResponseEntity<Void> remove = restTemplate.exchange(
                "/api/v1/offline/preferences/" + chapterId, HttpMethod.DELETE, auth(null), Void.class);
        assertThat(remove.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void searchFindsNovelByTitle() {
        ResponseEntity<List> results = restTemplate.exchange(
                "/api/v1/novels/search?q=" + novelRepository.findById(novelId).orElseThrow().getTitle(),
                HttpMethod.GET,
                auth(null),
                List.class);
        assertThat(results.getBody()).isNotEmpty();
    }
}
