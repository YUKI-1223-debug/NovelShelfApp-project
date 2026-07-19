package com.novelshelf.infrastructure.adapter.kakuyomu;

import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteCode;
import com.novelshelf.domain.novel.UnresolvableNovelUrlException;
import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import com.novelshelf.infrastructure.adapter.NovelSiteAdapter;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * カクヨム向けSiteAdapter実装。
 *
 * <p>公式の開発者向けAPIが存在しないため、実際にブラウザが受け取るページのHTMLをそのまま取得する
 * （robots.txtの{@code ClaudeBot}向けCrawl-delay: 1に準じて{@link KakuyomuRateLimiter}で1秒間隔を守り、
 * 一括クロールは行わない。詳細はdocs/DECISIONS.md参照）。
 *
 * <p>作品トップページ・話一覧はNext.jsアプリが埋め込む{@code __NEXT_DATA__}内の
 * Apollo正規化キャッシュ（{@code __APOLLO_STATE__}）から構造化データとして取得する
 * （画面に表示されるのと同じ1リクエストで話一覧全件が取得できるため、なろうと違いページングの制約がない）。
 * 一方、話本文ページ自体はNext.js化されておらず、{@code widget-episodeBody}クラスのHTMLをそのまま
 * スクレイピングする必要がある。
 */
@Component
public class KakuyomuAdapter implements NovelSiteAdapter {

    private static final Pattern WORK_ID_PATTERN = Pattern.compile("kakuyomu\\.jp/works/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final String USER_AGENT = "NovelShelfApp/0.1 (personal-use reading app; +https://github.com/)";

    private final KakuyomuProperties properties;
    private final KakuyomuRateLimiter rateLimiter;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public KakuyomuAdapter(KakuyomuProperties properties, KakuyomuRateLimiter rateLimiter) {
        this.properties = properties;
        this.rateLimiter = rateLimiter;
    }

    @Override
    public SiteCode siteCode() {
        return SiteCode.KAKUYOMU;
    }

    @Override
    public boolean isSupported() {
        return true;
    }

    public static String extractWorkId(String url) {
        Matcher matcher = WORK_ID_PATTERN.matcher(url);
        if (!matcher.find()) {
            throw new UnresolvableNovelUrlException(url);
        }
        return matcher.group(1);
    }

    @Override
    public ExternalNovelMetadata resolveNovel(String url) {
        String workId = extractWorkId(url);
        Document doc = fetchHtml(properties.siteBaseUrl() + "/works/" + workId);
        JsonNode apollo = extractApolloState(doc, url);

        JsonNode work = apollo.path("Work:" + workId);
        if (work.isMissingNode()) {
            throw new UnresolvableNovelUrlException(url);
        }
        JsonNode author = resolveRef(apollo, work.path("author"));

        String authorHandle = author.path("name").asString();
        String authorName = author.path("activityName").asString();
        if (authorName == null || authorName.isBlank()) {
            authorName = authorHandle;
        }
        boolean isRunning = "RUNNING".equals(work.path("serialStatus").asString());

        return new ExternalNovelMetadata(
                workId,
                work.path("title").asString(),
                author.path("id").asString(),
                authorName,
                properties.siteBaseUrl() + "/users/" + authorHandle,
                work.path("introduction").asString(),
                work.path("genre").asString(),
                properties.siteBaseUrl() + "/works/" + workId,
                isRunning ? NovelStatus.ONGOING : NovelStatus.COMPLETED,
                work.path("publicEpisodeCount").asInt());
    }

    @Override
    public List<ExternalChapter> fetchChapterList(String externalNovelId) {
        Document doc = fetchHtml(properties.siteBaseUrl() + "/works/" + externalNovelId);
        JsonNode apollo = extractApolloState(doc, properties.siteBaseUrl() + "/works/" + externalNovelId);
        JsonNode work = apollo.path("Work:" + externalNovelId);

        List<ExternalChapter> chapters = new ArrayList<>();
        int chapterNo = 0;
        for (JsonNode tocRef : work.path("tableOfContentsV2")) {
            JsonNode tocChapter = resolveRef(apollo, tocRef);
            for (JsonNode episodeRef : tocChapter.path("episodeUnions")) {
                JsonNode episode = resolveRef(apollo, episodeRef);
                if (episode.isMissingNode()) {
                    continue;
                }
                chapterNo++;
                String episodeId = episode.path("id").asString();
                Instant publishedAt = parseInstant(episode.path("publishedAt").asString());
                chapters.add(new ExternalChapter(
                        episodeId,
                        chapterNo,
                        episode.path("title").asString(),
                        properties.siteBaseUrl() + "/works/" + externalNovelId + "/episodes/" + episodeId,
                        publishedAt));
            }
        }
        return chapters;
    }

    @Override
    public ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId) {
        String episodeUrl = properties.siteBaseUrl() + "/works/" + externalNovelId + "/episodes/" + externalChapterId;
        Document doc = fetchHtml(episodeUrl);

        Element titleEl = doc.selectFirst("p.widget-episodeTitle");
        Element bodyEl = doc.selectFirst("div.widget-episodeBody");
        if (titleEl == null || bodyEl == null) {
            throw new UnresolvableNovelUrlException(episodeUrl);
        }

        StringBuilder html = new StringBuilder();
        for (Element paragraph : bodyEl.select("p")) {
            html.append("<p>").append(paragraph.html()).append("</p>\n");
        }

        return new ExternalChapterContent(titleEl.text().trim(), html.toString(), episodeUrl);
    }

    private JsonNode extractApolloState(Document doc, String url) {
        Element script = doc.selectFirst("script#__NEXT_DATA__");
        if (script == null) {
            throw new UnresolvableNovelUrlException(url);
        }
        JsonNode root = objectMapper.readTree(script.data());
        JsonNode apollo = root.path("props").path("pageProps").path("__APOLLO_STATE__");
        if (apollo.isMissingNode()) {
            throw new UnresolvableNovelUrlException(url);
        }
        return apollo;
    }

    // Apollo正規化キャッシュの{"__ref": "Type:id"}参照を実体に解決する。
    private JsonNode resolveRef(JsonNode apollo, JsonNode refNode) {
        String ref = refNode.path("__ref").asString();
        return apollo.path(ref == null ? "" : ref);
    }

    private Document fetchHtml(String url) {
        rateLimiter.throttle();
        try {
            return Jsoup.connect(url).userAgent(USER_AGENT).timeout(10_000).get();
        } catch (java.io.IOException e) {
            throw new UnresolvableNovelUrlException(url);
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Instant.parse(value);
    }
}
