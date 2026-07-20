package com.novelshelf.infrastructure.adapter.hameln;

import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteAccessBlockedException;
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
 *
 * <p>R18作品は別サブドメイン（{@code h.syosetu.org}）で提供されており、通常版とは別サイトとして
 * 扱う必要がある（なろうのnovel18.syosetu.comと同様の構成。docs/DECISIONS.md参照）。externalNovelIdは
 * 通常サイトと衝突しないよう{@code "r18:" + novelId}の形式で保存する。
 */
@Component
public class HamelnAdapter implements NovelSiteAdapter {

    private static final Pattern NOVEL_ID_PATTERN = Pattern.compile("syosetu\\.org/novel/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern R18_HOST_PATTERN = Pattern.compile("(^|//)h\\.syosetu\\.org", Pattern.CASE_INSENSITIVE);
    private static final Pattern USER_ID_PATTERN = Pattern.compile("/user/(\\d+)");
    private static final Pattern EPISODE_HREF_PATTERN = Pattern.compile("^\\./?(\\d+)\\.html$");
    private static final String USER_AGENT = "NovelShelfApp/0.1 (personal-use reading app; +https://github.com/)";
    private static final String R18_ID_PREFIX = "r18:";
    // 短編(単話)は目次ページを持たず、作品トップページ自体が本文ページになる（実話数と衝突しないよう0を使う）。
    private static final String TANPEN_CHAPTER_ID = "0";

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

    private static boolean isR18Url(String url) {
        return R18_HOST_PATTERN.matcher(url).find();
    }

    private boolean isR18ExternalId(String externalNovelId) {
        return externalNovelId.startsWith(R18_ID_PREFIX);
    }

    private String rawNovelId(String externalNovelId) {
        return isR18ExternalId(externalNovelId) ? externalNovelId.substring(R18_ID_PREFIX.length()) : externalNovelId;
    }

    private String siteBaseUrlFor(boolean r18) {
        return r18 ? properties.r18SiteBaseUrl() : properties.siteBaseUrl();
    }

    @Override
    public ExternalNovelMetadata resolveNovel(String url) {
        boolean r18 = isR18Url(url);
        String novelId = extractNovelId(url);
        String siteBaseUrl = siteBaseUrlFor(r18);
        String topUrl = siteBaseUrl + "/novel/" + novelId + "/";
        Document doc = fetchHtml(topUrl);

        Element titleEl = doc.selectFirst("[itemprop=name]");
        Element authorLinkEl = doc.selectFirst("[itemprop=author] a");

        String title;
        String authorHref;
        String authorName;
        if (titleEl != null && authorLinkEl != null) {
            title = titleEl.text().trim();
            authorHref = authorLinkEl.attr("href");
            authorName = authorLinkEl.text().trim();
        } else {
            // 短編(単話)ページにはitemprop=name/authorのマイクロデータが存在しないため、
            // og:titleと本文中の作者リンク（ページ内で唯一の/user/リンク）から代わりに取得する。
            Element tanpenTitleEl = doc.selectFirst("meta[property=og:title]");
            Element tanpenAuthorEl = doc.selectFirst("a[href*=/user/]");
            if (tanpenTitleEl == null || tanpenAuthorEl == null) {
                throw new UnresolvableNovelUrlException(url);
            }
            title = tanpenTitleEl.attr("content").split(" - ")[0].trim();
            authorHref = tanpenAuthorEl.attr("href");
            authorName = tanpenAuthorEl.text().trim();
        }

        Matcher userIdMatcher = USER_ID_PATTERN.matcher(authorHref);
        String authorId = userIdMatcher.find() ? userIdMatcher.group(1) : authorHref;

        Element descriptionEl = doc.selectFirst("meta[property=og:description]");
        String synopsis = descriptionEl != null ? descriptionEl.attr("content") : "";

        List<ExternalChapter> chapters = parseChapterListWithTanpenFallback(doc, siteBaseUrl, novelId, topUrl, title);

        return new ExternalNovelMetadata(
                r18 ? R18_ID_PREFIX + novelId : novelId,
                title,
                authorId,
                authorName,
                authorHref,
                synopsis,
                null,
                topUrl,
                NovelStatus.ONGOING,
                chapters.size());
    }

    @Override
    public List<ExternalChapter> fetchChapterList(String externalNovelId) {
        boolean r18 = isR18ExternalId(externalNovelId);
        String novelId = rawNovelId(externalNovelId);
        String siteBaseUrl = siteBaseUrlFor(r18);
        String topUrl = siteBaseUrl + "/novel/" + novelId + "/";
        Document doc = fetchHtml(topUrl);
        Element ogTitleEl = doc.selectFirst("meta[property=og:title]");
        String title = ogTitleEl != null ? ogTitleEl.attr("content").split(" - ")[0].trim() : "";
        return parseChapterListWithTanpenFallback(doc, siteBaseUrl, novelId, topUrl, title);
    }

    // 短編(単話)は目次テーブルを持たないため、通常の話一覧パースで0件だった場合は
    // 作品トップページ自体を唯一の話として扱う（本文もこのページに直接載っている）。
    private List<ExternalChapter> parseChapterListWithTanpenFallback(
            Document doc, String siteBaseUrl, String novelId, String topUrl, String title) {
        List<ExternalChapter> chapters = parseChapterList(doc, siteBaseUrl, novelId);
        if (!chapters.isEmpty()) {
            return chapters;
        }
        return List.of(new ExternalChapter(TANPEN_CHAPTER_ID, 1, title, topUrl, null));
    }

    private List<ExternalChapter> parseChapterList(Document doc, String siteBaseUrl, String novelId) {
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
                    siteBaseUrl + "/novel/" + novelId + "/" + chapterNo + ".html",
                    publishedAt));
        }
        chapters.sort((a, b) -> Integer.compare(a.chapterNo(), b.chapterNo()));
        return chapters;
    }

    @Override
    public ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId) {
        String siteBaseUrl = siteBaseUrlFor(isR18ExternalId(externalNovelId));
        String novelId = rawNovelId(externalNovelId);
        String episodeUrl = TANPEN_CHAPTER_ID.equals(externalChapterId)
                ? siteBaseUrl + "/novel/" + novelId + "/"
                : siteBaseUrl + "/novel/" + novelId + "/" + externalChapterId + ".html";
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
            // over18=offクッキーはR18サイト(h.syosetu.org)の年齢確認ページ回避に必要
            // （実機確認済み、値は"off"で年齢確認を求めない状態を表す模様）。
            // 通常サイト側では単に無視されるだけなので、常に付与して分岐を避けている。
            return Jsoup.connect(url).userAgent(USER_AGENT).cookie("over18", "off").timeout(10_000).get();
        } catch (org.jsoup.HttpStatusException e) {
            // 403等はURLの形式が不正なのではなく、サイト側のBot対策等でアクセス自体を
            // 拒否されているケースが多い（本番VPSのIPがh.syosetu.orgのCloudflare Bot対策に
            // ブロックされる事例で判明、docs/KNOWN_ISSUES.md参照）。「URLとして認識できない」
            // という誤解を招くメッセージにならないよう区別する。
            throw new SiteAccessBlockedException(url, e.getStatusCode());
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
