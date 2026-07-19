package com.novelshelf.infrastructure.adapter;

import com.novelshelf.domain.novel.SiteCode;
import com.novelshelf.domain.novel.SiteNotSupportedException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * SiteCodeごとに実装済みのNovelSiteAdapterを解決する。 未実装（カクヨム/ハーメルン/pixiv小説、利用規約確認待ち）のサイトは
 * {@link SiteNotSupportedException} を送出し、呼び出し元（IngestUseCase）がリンク登録のみのフォールバックに切り替える。
 */
@Component
public class SiteAdapterRegistry {

    private final Map<SiteCode, NovelSiteAdapter> adaptersByCode;

    public SiteAdapterRegistry(List<NovelSiteAdapter> adapters) {
        this.adaptersByCode = adapters.stream().collect(Collectors.toMap(NovelSiteAdapter::siteCode, Function.identity()));
    }

    public NovelSiteAdapter resolve(SiteCode siteCode) {
        NovelSiteAdapter adapter = adaptersByCode.get(siteCode);
        if (adapter == null || !adapter.isSupported()) {
            throw new SiteNotSupportedException(siteCode);
        }
        return adapter;
    }

    public NovelSiteAdapter resolveByUrl(String url) {
        for (SiteCode siteCode : SiteCode.values()) {
            if (matchesSite(siteCode, url)) {
                return resolve(siteCode);
            }
        }
        throw new com.novelshelf.domain.novel.UnresolvableNovelUrlException(url);
    }

    public SiteCode identifySite(String url) {
        for (SiteCode siteCode : SiteCode.values()) {
            if (matchesSite(siteCode, url)) {
                return siteCode;
            }
        }
        throw new com.novelshelf.domain.novel.UnresolvableNovelUrlException(url);
    }

    private boolean matchesSite(SiteCode siteCode, String url) {
        return switch (siteCode) {
            case NAROU -> url.contains("ncode.syosetu.com") || url.contains("novel18.syosetu.com");
            case KAKUYOMU -> url.contains("kakuyomu.jp");
            case HAMELN -> url.contains("syosetu.org");
            case PIXIV -> url.contains("pixiv.net");
        };
    }
}
