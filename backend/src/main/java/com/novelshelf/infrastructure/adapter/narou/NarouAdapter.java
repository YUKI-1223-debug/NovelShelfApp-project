package com.novelshelf.infrastructure.adapter.narou;

import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteCode;
import com.novelshelf.domain.novel.UnresolvableNovelUrlException;
import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import com.novelshelf.infrastructure.adapter.NovelSiteAdapter;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 小説家になろう向けSiteAdapter実装。
 *
 * <p>作品メタデータは「なろう小説API」（公式提供、二次利用ガイドライン準拠）から取得する。 本文・話一覧は同APIでは提供されないため、
 * ユーザーが実際に読む話のページを1件ずつ取得する（robots.txtのCrawl-delay:
 * 1を{@link NarouRateLimiter}で遵守し、一括クロールは行わない）。詳細はdocs/DECISIONS.mdを参照。
 */
@Component
public class NarouAdapter implements NovelSiteAdapter {

    private static final Pattern NCODE_PATTERN =
            Pattern.compile("ncode\\.syosetu\\.com/([a-zA-Z0-9]+)", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter UPDATE_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm");
    private static final ZoneId JST = ZoneId.of("Asia/Tokyo");
    private static final String USER_AGENT = "NovelShelfApp/0.1 (personal-use reading app; +https://github.com/)";

    private final NarouProperties properties;
    private final NarouRateLimiter rateLimiter;
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public NarouAdapter(NarouProperties properties, NarouRateLimiter rateLimiter) {
        this.properties = properties;
        this.rateLimiter = rateLimiter;
    }

    @Override
    public SiteCode siteCode() {
        return SiteCode.NAROU;
    }

    @Override
    public boolean isSupported() {
        return true;
    }

    public static String extractNcode(String url) {
        Matcher matcher = NCODE_PATTERN.matcher(url);
        if (!matcher.find()) {
            throw new UnresolvableNovelUrlException(url);
        }
        return matcher.group(1).toLowerCase();
    }

    @Override
    public ExternalNovelMetadata resolveNovel(String url) {
        String ncode = extractNcode(url);
        String apiUrl = properties.apiBaseUrl() + "?out=json&ncode=" + ncode;
        String responseBody = restClient.get().uri(apiUrl).retrieve().body(String.class);

        JsonNode root = objectMapper.readTree(responseBody);
        if (root == null || root.size() < 2) {
            throw new UnresolvableNovelUrlException(url);
        }
        JsonNode novel = root.get(1);

        long userId = novel.path("userid").asLong();
        return new ExternalNovelMetadata(
                ncode,
                novel.path("title").asString(),
                String.valueOf(userId),
                novel.path("writer").asString(),
                "https://mypage.syosetu.com/" + userId + "/",
                novel.path("story").asString(),
                String.valueOf(novel.path("genre").asInt()),
                properties.siteBaseUrl() + "/" + ncode + "/",
                novel.path("end").asInt() == 1 ? NovelStatus.COMPLETED : NovelStatus.ONGOING,
                novel.path("general_all_no").asInt());
    }

    @Override
    public List<ExternalChapter> fetchChapterList(String externalNovelId) {
        String tocUrl = properties.siteBaseUrl() + "/" + externalNovelId + "/";
        Document doc = fetchHtml(tocUrl);

        List<ExternalChapter> chapters = new ArrayList<>();
        for (Element item : doc.select("div.p-eplist__sublist")) {
            Element link = item.selectFirst("a.p-eplist__subtitle");
            if (link == null) {
                continue;
            }
            String href = link.attr("href");
            int chapterNo = extractChapterNo(href);
            String title = link.text().trim();
            Instant publishedAt = parseUpdateDate(item.selectFirst("div.p-eplist__update"));
            chapters.add(new ExternalChapter(
                    String.valueOf(chapterNo), chapterNo, title, properties.siteBaseUrl() + href, publishedAt));
        }
        return chapters;
    }

    @Override
    public ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId) {
        String episodeUrl = properties.siteBaseUrl() + "/" + externalNovelId + "/" + externalChapterId + "/";
        Document doc = fetchHtml(episodeUrl);

        Element titleEl = doc.selectFirst("h1.p-novel__title");
        Element bodyEl = doc.selectFirst("div.p-novel__text");
        if (titleEl == null || bodyEl == null) {
            throw new UnresolvableNovelUrlException(episodeUrl);
        }

        StringBuilder html = new StringBuilder();
        for (Element paragraph : bodyEl.select("p")) {
            html.append("<p>").append(paragraph.html()).append("</p>\n");
        }

        return new ExternalChapterContent(titleEl.text().trim(), html.toString(), episodeUrl);
    }

    private Document fetchHtml(String url) {
        rateLimiter.throttle();
        try {
            return Jsoup.connect(url).userAgent(USER_AGENT).timeout(10_000).get();
        } catch (java.io.IOException e) {
            throw new UnresolvableNovelUrlException(url);
        }
    }

    private static int extractChapterNo(String href) {
        Matcher matcher = Pattern.compile("/(\\d+)/?$").matcher(href);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return 0;
    }

    private static Instant parseUpdateDate(Element updateEl) {
        if (updateEl == null) {
            return null;
        }
        String text = updateEl.text().trim();
        Matcher matcher = Pattern.compile("(\\d{4}/\\d{2}/\\d{2} \\d{2}:\\d{2})").matcher(text);
        if (!matcher.find()) {
            return null;
        }
        LocalDateTime local = LocalDateTime.parse(matcher.group(1), UPDATE_DATE_FORMAT);
        return local.atZone(JST).toInstant();
    }
}
