package com.novelshelf.application.novel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.novelshelf.domain.novel.*;
import com.novelshelf.infrastructure.adapter.ExternalNovelMetadata;
import com.novelshelf.infrastructure.adapter.NovelSiteAdapter;
import com.novelshelf.infrastructure.adapter.SiteAdapterRegistry;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IngestServiceTest {

    @Mock
    private SiteAdapterRegistry adapterRegistry;

    @Mock
    private SiteRepository siteRepository;

    @Mock
    private AuthorRepository authorRepository;

    @Mock
    private NovelRepository novelRepository;

    @Mock
    private NovelSiteAdapter adapter;

    private static final String URL = "https://ncode.syosetu.com/n0000aa/";

    private Site site() {
        return Site.builder().id(UUID.randomUUID()).code(SiteCode.NAROU).name("なろう").baseUrl("https://syosetu.com").build();
    }

    private ExternalNovelMetadata metadataWithTitle(String title) {
        return new ExternalNovelMetadata(
                "n0000aa", title, "author-1", "作者", null, "あらすじ", "恋愛", URL, NovelStatus.ONGOING, 10);
    }

    // なろう/カクヨム/ハーメルンいずれかのアダプタがページ構造の想定外により
    // タイトルを空文字/nullで返した場合でも、本棚に何も表示されない状態にはせず
    // URLへフォールバックする(①の再発防止)。
    @Test
    void resolveNovel_fallsBackToSourceUrl_whenAdapterReturnsBlankTitleForNewNovel() {
        Site site = site();
        when(adapterRegistry.identifySite(URL)).thenReturn(SiteCode.NAROU);
        when(siteRepository.findByCode(SiteCode.NAROU)).thenReturn(Optional.of(site));
        when(adapterRegistry.resolve(SiteCode.NAROU)).thenReturn(adapter);
        when(adapter.resolveNovel(URL)).thenReturn(metadataWithTitle(""));
        when(authorRepository.findBySiteIdAndExternalAuthorId(site.getId(), "author-1")).thenReturn(Optional.empty());
        when(authorRepository.save(any())).thenAnswer(inv -> {
            Author a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });
        when(novelRepository.findBySiteIdAndExternalNovelId(site.getId(), "n0000aa")).thenReturn(Optional.empty());
        when(novelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IngestService service = new IngestService(adapterRegistry, siteRepository, authorRepository, novelRepository);
        Novel result = service.resolveNovel(URL);

        assertThat(result.getTitle()).isEqualTo(URL);
    }

    // 既に正しいタイトルを持つ作品を再取得(更新確認・再追加など)した際、サイト側の一時的な
    // 取得失敗で空タイトルが返ってきても、既存の正しいタイトルを空で上書きしない(①の再発防止)。
    @Test
    void resolveNovel_keepsExistingTitle_whenReResolveReturnsBlankTitle() {
        Site site = site();
        Author existingAuthor = Author.builder().id(UUID.randomUUID()).siteId(site.getId()).externalAuthorId("author-1").name("作者").build();
        Novel existingNovel = Novel.builder()
                .id(UUID.randomUUID())
                .siteId(site.getId())
                .authorId(existingAuthor.getId())
                .externalNovelId("n0000aa")
                .title("既存の正しいタイトル")
                .sourceUrl(URL)
                .status(NovelStatus.ONGOING)
                .latestKnownChapterNo(10)
                .build();

        when(adapterRegistry.identifySite(URL)).thenReturn(SiteCode.NAROU);
        when(siteRepository.findByCode(SiteCode.NAROU)).thenReturn(Optional.of(site));
        when(adapterRegistry.resolve(SiteCode.NAROU)).thenReturn(adapter);
        when(adapter.resolveNovel(URL)).thenReturn(metadataWithTitle(null));
        when(authorRepository.findBySiteIdAndExternalAuthorId(site.getId(), "author-1")).thenReturn(Optional.of(existingAuthor));
        when(authorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(novelRepository.findBySiteIdAndExternalNovelId(site.getId(), "n0000aa")).thenReturn(Optional.of(existingNovel));
        when(novelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IngestService service = new IngestService(adapterRegistry, siteRepository, authorRepository, novelRepository);
        Novel result = service.resolveNovel(URL);

        assertThat(result.getTitle()).isEqualTo("既存の正しいタイトル");
    }
}
