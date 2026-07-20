package com.novelshelf.application.novel;

import com.novelshelf.domain.novel.*;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import com.novelshelf.infrastructure.adapter.NovelSiteAdapter;
import com.novelshelf.infrastructure.adapter.SiteAdapterRegistry;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 外部サイトから作品情報を取り込み、内部DBへ永続化する。
 * 未対応サイト（{@link SiteNotSupportedException}）、および対応サイトではあるが
 * サイト側のアクセス制限で一時的に取得できない場合（{@link SiteAccessBlockedException}、
 * 例: h.syosetu.orgがサーバーのIPをBot対策でブロックする事例。docs/KNOWN_ISSUES.md参照）は、
 * 本文取得を伴わないプレースホルダー作品として登録し、本棚へのリンク登録のみを可能にする
 * （アーキテクチャ上のFallbackLinkAdapter相当）。
 */
@Service
public class IngestService {

    private final SiteAdapterRegistry adapterRegistry;
    private final SiteRepository siteRepository;
    private final AuthorRepository authorRepository;
    private final NovelRepository novelRepository;

    public IngestService(
            SiteAdapterRegistry adapterRegistry,
            SiteRepository siteRepository,
            AuthorRepository authorRepository,
            NovelRepository novelRepository) {
        this.adapterRegistry = adapterRegistry;
        this.siteRepository = siteRepository;
        this.authorRepository = authorRepository;
        this.novelRepository = novelRepository;
    }

    @Transactional
    public Novel resolveNovel(String url) {
        SiteCode siteCode = adapterRegistry.identifySite(url);
        Site site = siteRepository
                .findByCode(siteCode)
                .orElseThrow(() -> new IllegalStateException("サイトマスタが未シードです: " + siteCode));

        try {
            NovelSiteAdapter adapter = adapterRegistry.resolve(siteCode);
            return ingestFromAdapter(site, adapter, url);
        } catch (SiteNotSupportedException | SiteAccessBlockedException e) {
            return resolvePlaceholder(site, url);
        }
    }

    private Novel ingestFromAdapter(Site site, NovelSiteAdapter adapter, String url) {
        ExternalNovelMetadata meta = adapter.resolveNovel(url);

        Author author = authorRepository
                .findBySiteIdAndExternalAuthorId(site.getId(), meta.authorExternalId())
                .map(existing -> {
                    existing.setName(meta.authorName());
                    existing.setProfileUrl(meta.authorProfileUrl());
                    return existing;
                })
                .orElseGet(() -> authorRepository.save(Author.builder()
                        .siteId(site.getId())
                        .externalAuthorId(meta.authorExternalId())
                        .name(meta.authorName())
                        .profileUrl(meta.authorProfileUrl())
                        .build()));
        author = authorRepository.save(author);

        Author finalAuthor = author;
        Novel novel = novelRepository
                .findBySiteIdAndExternalNovelId(site.getId(), meta.externalNovelId())
                .map(existing -> applyMetadata(existing, meta, finalAuthor.getId()))
                .orElseGet(() -> Novel.builder()
                        .siteId(site.getId())
                        .authorId(finalAuthor.getId())
                        .externalNovelId(meta.externalNovelId())
                        .title(meta.title())
                        .synopsis(meta.synopsis())
                        .genre(meta.genre())
                        .sourceUrl(meta.sourceUrl())
                        .status(meta.status())
                        .latestKnownChapterNo(meta.totalChapters())
                        .build());

        return novelRepository.save(novel);
    }

    private Novel applyMetadata(Novel novel, ExternalNovelMetadata meta, UUID authorId) {
        novel.setAuthorId(authorId);
        novel.setTitle(meta.title());
        novel.setSynopsis(meta.synopsis());
        novel.setGenre(meta.genre());
        novel.setStatus(meta.status());
        novel.setLatestKnownChapterNo(meta.totalChapters());
        novel.setUpdatedAt(Instant.now());
        return novel;
    }

    private Novel resolvePlaceholder(Site site, String url) {
        Author unknownAuthor = authorRepository
                .findBySiteIdAndExternalAuthorId(site.getId(), "unknown")
                .orElseGet(() -> authorRepository.save(Author.builder()
                        .siteId(site.getId())
                        .externalAuthorId("unknown")
                        .name("不明（" + site.getName() + "）")
                        .build()));

        return novelRepository
                .findBySiteIdAndExternalNovelId(site.getId(), url)
                .orElseGet(() -> novelRepository.save(Novel.builder()
                        .siteId(site.getId())
                        .authorId(unknownAuthor.getId())
                        .externalNovelId(url)
                        .title(url)
                        .sourceUrl(url)
                        .status(NovelStatus.ONGOING)
                        .latestKnownChapterNo(0)
                        .build()));
    }
}
