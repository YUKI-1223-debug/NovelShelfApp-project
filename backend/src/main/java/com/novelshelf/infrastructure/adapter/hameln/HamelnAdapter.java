package com.novelshelf.infrastructure.adapter.hameln;

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

/**
 * ハーメルン（syosetu.org）向けSiteAdapter実装。
 *
 * <p>公式の開発者向けAPIが存在しないため、ページのHTMLをそのまま取得する
 * （汎用UAへの明示的なCrawl-delay指定はrobots.txtにないが、なろう・カクヨムに準じて
 * {@link HamelnRateLimiter}で1秒間隔を自主的に守り、一括クロールは行わない。docs/DECISIONS.md参照）。
 * 作品トップページはschema.orgのmicrodata（{@code itemprop}属性）が振られておりCSSセレクタで
 * 安定して取得できる。話一覧は作品トップページに全話分が1ページで載る（なろうと違いページングの制約がない）。
 * 話本文ページは{@code id="honbun"}が本文、{@code id="maegaki"}/{@code id="atogaki"}が前書き・あとがきで、
 * 別々の要素に分かれているため、なろうのような取り違えは起きない。
 *
 * <p>完結/連載中の判定は作品トップページから安定して取得できる手段が見つからなかったため、
 * 常に{@link NovelStatus#ONGOING}として登録する（docs/KNOWN_ISSUES.md参照）。
 */
@Component
public class HamelnAdapter implements NovelSiteAdapter {

    private static final Pattern NOVEL_ID_PATTERN = Pattern.compile("syosetu\\.org/novel/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern USER_ID_PATTERN = Pattern.compile("/user/(\\d+)");
    private static final Pattern EPISODE_HREF_PATTERN = Pattern.compile("^\\./?(\\d+)\\.html$");
    private static final String USER_AGENT = "NovelShelfApp/0.1 (personal-use reading app; +https://github.com/)";

    private final HamelnProperties properties;
    private final HamelnRateLimiter rateLimiter;

    public HamelnAdapter(HamelnProperties properties, HamelnRateLimiter rateLimiter) {
        this.properties = properties;
        this.rateLimiter = rateLimiter;
    }

    @Override
    public SiteCode siteCode() {
        return SiteCode.HAMELN;
    }

    @Override
    public boolean isSupported() {
        return true;
    }

    public static String extractNovelId(String url) {
        Matcher matcher = NOVEL_ID_PATTERN.matcher(url);
        if (!matcher.find()) {
            throw new UnresolvableNovelUrlException(url);
        }
        return matcher.group(1);
    }

    @Override
    public ExternalNovelMetadata resolveNovel(String url) {
        String novelId = extractNovelId(url);
        String topUrl = properties.siteBaseUrl() + "/novel/" + novelId + "/";
        Document doc = fetchHtml(topUrl);

        Element titleEl = doc.selectFirst("[itemprop=name]");
        Element authorLinkEl = doc.selectFirst("[itemprop=author] a");
        if (titleEl == null || authorLinkEl == null) {
            throw new UnresolvableNovelUrlException(url);
        }
        String authorHref = authorLinkEl.attr("href");
        Matcher userIdMatcher = USER_ID_PATTERN.matcher(authorHref);
        String authorId = userIdMatcher.find() ? userIdMatcher.group(1) : authorHref;

        Element descriptionEl = doc.selectFirst("meta[property=og:description]");
        String synopsis = descriptionEl != null ? descriptionEl.attr("content") : "";

        List<ExternalChapter> chapters = parseChapterList(doc);

        return new ExternalNovelMetadata(
                novelId,
                titleEl.text().trim(),
                authorId,
                authorLinkEl.text().trim(),
                authorHref,
                synopsis,
                null,
                topUrl,
                NovelStatus.ONGOING,
                chapters.size());
    }

    @Override
    public List<ExternalChapter> fetchChapterList(String externalNovelId) {
        Document doc = fetchHtml(properties.siteBaseUrl() + "/novel/" + externalNovelId + "/");
        return parseChapterList(doc);
    }

    private List<ExternalChapter> parseChapterList(Document doc) {
        String novelId = extractNovelIdFromDoc(doc);
        List<ExternalChapter> chapters = new ArrayList<>();
        for (Element row : doc.select("tr:has(a[href])")) {
            Element link = row.selectFirst("a[href]");
            if (link == null) {
                continue;
            }
            Matcher matcher = EPISODE_HREF_PATTERN.matcher(link.attr("href"));
            if (!matcher.matches()) {
                continue;
            }
            int chapterNo = Integer.parseInt(matcher.group(1));
            Element timeEl = row.selectFirst("time[itemprop=datePublished]");
            Instant publishedAt = timeEl != null ? parseInstant(timeEl.attr("datetime")) : null;
            chapters.add(new ExternalChapter(
                    String.valueOf(chapterNo),
                    chapterNo,
                    link.text().trim(),
                    properties.siteBaseUrl() + "/novel/" + novelId + "/" + chapterNo + ".html",
                    publishedAt));
        }
        chapters.sort((a, b) -> Integer.compare(a.chapterNo(), b.chapterNo()));
        return chapters;
    }

    private String extractNovelIdFromDoc(Document doc) {
        Element canonical = doc.selectFirst("meta[property=og:url]");
        if (canonical != null) {
            return extractNovelId(canonical.attr("content"));
        }
        return extractNovelId(doc.location());
    }

    @Override
    public ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId) {
        String episodeUrl = properties.siteBaseUrl() + "/novel/" + externalNovelId + "/" + externalChapterId + ".html";
        Document doc = fetchHtml(episodeUrl);

        Element bodyEl = doc.selectFirst("div#honbun");
        Element ogTitleEl = doc.selectFirst("meta[property=og:title]");
        if (bodyEl == null || ogTitleEl == null) {
            throw new UnresolvableNovelUrlException(episodeUrl);
        }
        String title = ogTitleEl.attr("content").split(" - ")[0].trim();

        StringBuilder html = new StringBuilder();
        for (Element paragraph : bodyEl.select("p")) {
            html.append("<p>").append(paragraph.html()).append("</p>\n");
        }

        return new ExternalChapterContent(title, html.toString(), episodeUrl);
    }

    private Document fetchHtml(String url) {
        rateLimiter.throttle();
        try {
            return Jsoup.connect(url).userAgent(USER_AGENT).timeout(10_000).get();
        } catch (java.io.IOException e) {
            throw new UnresolvableNovelUrlException(url);
        }
    }

    private static final Pattern MISSING_SECONDS_PATTERN = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2})Z$");

    private static Instant parseInstant(String datetime) {
        if (datetime == null || datetime.isBlank()) {
            return null;
        }
        // ハーメルンの<time datetime>は秒を省略した形式（例: 2026-07-12T17:33Z）で出力されることがある。
        Matcher missingSeconds = MISSING_SECONDS_PATTERN.matcher(datetime);
        String normalized = missingSeconds.matches() ? missingSeconds.group(1) + ":00Z" : datetime;
        try {
            return Instant.parse(normalized);
        } catch (Exception e) {
            return null;
        }
    }
}
