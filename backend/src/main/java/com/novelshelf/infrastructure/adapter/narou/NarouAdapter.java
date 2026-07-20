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
 *
 * <p>ノクターン/ムーンライト/ミッドナイトノベルズ（R18、{@code novel18.syosetu.com}）にも対応する。
 * R18小説APIは通常APIと同じ利用規約・レート制限のもとで公式提供されている（{@code https://dev.syosetu.com/xman/api/}）。
 * このアプリは1ユーザーの個人利用専用（{@code docs/PROGRESS.md}参照）であり、R18小説API利用規約が定める
 * 「18歳未満に閲覧させないこと」は、ユーザー自身のログイン必須の個人インスタンスであることをもって満たす前提とする。
 * 年齢確認クッキー（{@code over18=yes}）を送ることで確認ページを回避する。externalNovelIdは通常サイトと衝突しないよう
 * {@code "r18:" + ncode} の形式で保存する。
 */
@Component
public class NarouAdapter implements NovelSiteAdapter {

    private static final Pattern NCODE_PATTERN =
            Pattern.compile("ncode\\.syosetu\\.com/([a-zA-Z0-9]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern R18_NCODE_PATTERN =
            Pattern.compile("novel18\\.syosetu\\.com/([a-zA-Z0-9]+)", Pattern.CASE_INSENSITIVE);
    private static final String R18_ID_PREFIX = "r18:";
    // 短編(単話)は話一覧を持たず、作品トップページ自体が本文ページになる（実話数と衝突しないよう0を使う）。
    private static final String TANPEN_CHAPTER_ID = "0";
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

    private static boolean isR18Url(String url) {
        return R18_NCODE_PATTERN.matcher(url).find();
    }

    private static String extractR18Ncode(String url) {
        Matcher matcher = R18_NCODE_PATTERN.matcher(url);
        if (!matcher.find()) {
            throw new UnresolvableNovelUrlException(url);
        }
        return matcher.group(1).toLowerCase();
    }

    @Override
    public ExternalNovelMetadata resolveNovel(String url) {
        if (isR18Url(url)) {
            return resolveR18Novel(url);
        }
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

    // R18小説API（novel18api）は通常APIと同じ形式のレスポンスだが、"genre"の代わりに
    // 掲載サイト区分を表す"nocgenre"（1:ノクターン 2:ムーンライト(女性向け) 3:ムーンライト(BL) 4:ミッドナイト）を返す。
    // 実疎通確認で判明した重要な差異: 通常API(novelapi)にはある"userid"（作者の数値ID）がR18API(novel18api)には
    // 含まれない。作品ページ側にも作者マイページへの安定したリンクは存在しない（footerの「作者Xマイページ」は
    // X(旧Twitter)への外部リンクで作者IDとは無関係）ため、作者名文字列をexternalAuthorIdとして代用する
    // （同姓同名の別作者は同一著者として扱われてしまう既知の制約、docs/KNOWN_ISSUES.md参照）。
    // プロフィールURLも取得手段がないためnullとする。
    private ExternalNovelMetadata resolveR18Novel(String url) {
        String ncode = extractR18Ncode(url);
        String apiUrl = properties.r18ApiBaseUrl() + "?out=json&ncode=" + ncode;
        String responseBody = restClient.get().uri(apiUrl).retrieve().body(String.class);

        JsonNode root = objectMapper.readTree(responseBody);
        if (root == null || root.size() < 2) {
            throw new UnresolvableNovelUrlException(url);
        }
        JsonNode novel = root.get(1);

        String writer = novel.path("writer").asString();
        return new ExternalNovelMetadata(
                R18_ID_PREFIX + ncode,
                novel.path("title").asString(),
                "r18-writer:" + writer,
                writer,
                null,
                novel.path("story").asString(),
                String.valueOf(novel.path("nocgenre").asInt()),
                properties.r18SiteBaseUrl() + "/" + ncode + "/",
                novel.path("end").asInt() == 1 ? NovelStatus.COMPLETED : NovelStatus.ONGOING,
                novel.path("general_all_no").asInt());
    }

    private boolean isR18ExternalId(String externalNovelId) {
        return externalNovelId.startsWith(R18_ID_PREFIX);
    }

    private String rawNcode(String externalNovelId) {
        return isR18ExternalId(externalNovelId) ? externalNovelId.substring(R18_ID_PREFIX.length()) : externalNovelId;
    }

    private String siteBaseUrlFor(String externalNovelId) {
        return isR18ExternalId(externalNovelId) ? properties.r18SiteBaseUrl() : properties.siteBaseUrl();
    }

    @Override
    public List<ExternalChapter> fetchChapterList(String externalNovelId) {
        String ncode = rawNcode(externalNovelId);
        String siteBaseUrl = siteBaseUrlFor(externalNovelId);
        String tocUrl = siteBaseUrl + "/" + ncode + "/";
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
            chapters.add(
                    new ExternalChapter(String.valueOf(chapterNo), chapterNo, title, siteBaseUrl + href, publishedAt));
        }
        if (chapters.isEmpty()) {
            // 短編(単話)は話一覧(p-eplist__sublist)を持たず、作品トップページ自体が本文ページになる。
            Element titleEl = doc.selectFirst("h1.p-novel__title");
            if (titleEl != null) {
                chapters.add(new ExternalChapter(TANPEN_CHAPTER_ID, 1, titleEl.text().trim(), tocUrl, null));
            }
        }
        return chapters;
    }

    @Override
    public ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId) {
        String ncode = rawNcode(externalNovelId);
        String siteBaseUrl = siteBaseUrlFor(externalNovelId);
        String episodeUrl = TANPEN_CHAPTER_ID.equals(externalChapterId)
                ? siteBaseUrl + "/" + ncode + "/"
                : siteBaseUrl + "/" + ncode + "/" + externalChapterId + "/";
        Document doc = fetchHtml(episodeUrl);

        Element titleEl = doc.selectFirst("h1.p-novel__title");
        // 前書き(p-novel__text--preface)・あとがき(p-novel__text--afterword)も本文と同じ
        // p-novel__textクラスを持ち、前書きがある話では本文より先に出現するため、
        // 単純な最初の一致では前書きを本文として誤取得してしまう。修飾クラスを除外して本文のみ選ぶ。
        Element bodyEl = doc.selectFirst(
                "div.p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)");
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
            // over18クッキーはR18サイト(novel18.syosetu.com)の年齢確認ページを回避するために必要。
            // 通常サイト側では単に無視されるだけなので、常に付与して分岐を避けている。
            return Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .cookie("over18", "yes")
                    .timeout(10_000)
                    .get();
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
