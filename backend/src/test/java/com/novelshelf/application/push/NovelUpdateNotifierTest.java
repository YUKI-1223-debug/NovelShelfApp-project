package com.novelshelf.application.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.novelshelf.application.novel.IngestService;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelRepository;
import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteRepository;
import com.novelshelf.domain.push.PushDeviceToken;
import com.novelshelf.domain.push.PushPlatform;
import com.novelshelf.domain.reading.ReadingPosition;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NovelUpdateNotifierTest {

    @Mock BookshelfEntryRepository bookshelfEntryRepository;
    @Mock NovelRepository novelRepository;
    @Mock SiteRepository siteRepository;
    @Mock ReadingPositionRepository readingPositionRepository;
    @Mock IngestService ingestService;
    @Mock PushDeviceService pushDeviceService;
    @Mock PushSender pushSender;

    NovelUpdateNotifier notifier;

    private final UUID novelId = UUID.randomUUID();
    private final UUID siteId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        notifier = new NovelUpdateNotifier(
                bookshelfEntryRepository,
                novelRepository,
                siteRepository,
                readingPositionRepository,
                ingestService,
                pushDeviceService,
                pushSender);
    }

    private Novel novelWithChapters(int latest) {
        return Novel.builder()
                .id(novelId)
                .siteId(siteId)
                .sourceUrl("https://ncode.syosetu.com/n0000aa/")
                .latestKnownChapterNo(latest)
                .title("テスト作品")
                .build();
    }

    private void stubSupportedSite() {
        Site site = Site.builder().id(siteId).supported(true).build();
        when(siteRepository.findById(siteId)).thenReturn(Optional.of(site));
    }

    @Test
    void notifies_shelfUsersWhoAreBehind_whenChapterCountIncreased() {
        UUID behindUser = UUID.randomUUID();
        UUID caughtUpUser = UUID.randomUUID();

        when(bookshelfEntryRepository.findDistinctNovelIds()).thenReturn(List.of(novelId));
        when(novelRepository.findById(novelId)).thenReturn(Optional.of(novelWithChapters(10)));
        stubSupportedSite();
        when(ingestService.resolveNovel(any())).thenReturn(novelWithChapters(12));
        when(bookshelfEntryRepository.findUserIdsByNovelId(novelId))
                .thenReturn(List.of(behindUser, caughtUpUser));
        when(readingPositionRepository.findByUserIdAndNovelId(behindUser, novelId))
                .thenReturn(Optional.of(ReadingPosition.builder().lastReadChapterNo(9).build()));
        when(readingPositionRepository.findByUserIdAndNovelId(caughtUpUser, novelId))
                .thenReturn(Optional.of(ReadingPosition.builder().lastReadChapterNo(12).build()));

        PushDeviceToken token = PushDeviceToken.builder()
                .userId(behindUser).platform(PushPlatform.ANDROID).token("tok-behind").build();
        when(pushDeviceService.tokensForUsers(List.of(behindUser))).thenReturn(List.of(token));
        when(pushSender.send(anyList(), any())).thenReturn(List.of());

        NovelUpdateNotifier.Summary summary = notifier.run();

        assertThat(summary.checked()).isEqualTo(1);
        assertThat(summary.updated()).isEqualTo(1);
        assertThat(summary.notified()).isEqualTo(1);

        ArgumentCaptor<List<String>> tokensCaptor = ArgumentCaptor.forClass(List.class);
        verify(pushSender).send(tokensCaptor.capture(), any(PushMessage.class));
        assertThat(tokensCaptor.getValue()).containsExactly("tok-behind");
    }

    @Test
    void doesNotNotify_whenChapterCountUnchanged() {
        when(bookshelfEntryRepository.findDistinctNovelIds()).thenReturn(List.of(novelId));
        when(novelRepository.findById(novelId)).thenReturn(Optional.of(novelWithChapters(10)));
        stubSupportedSite();
        when(ingestService.resolveNovel(any())).thenReturn(novelWithChapters(10));

        NovelUpdateNotifier.Summary summary = notifier.run();

        assertThat(summary.updated()).isZero();
        verify(pushSender, never()).send(anyList(), any());
    }

    @Test
    void skips_unsupportedSite() {
        when(bookshelfEntryRepository.findDistinctNovelIds()).thenReturn(List.of(novelId));
        when(novelRepository.findById(novelId)).thenReturn(Optional.of(novelWithChapters(10)));
        when(siteRepository.findById(siteId))
                .thenReturn(Optional.of(Site.builder().id(siteId).supported(false).build()));

        NovelUpdateNotifier.Summary summary = notifier.run();

        assertThat(summary.checked()).isZero();
        verify(ingestService, never()).resolveNovel(any());
    }

    @Test
    void removesDeadTokens_reportedBySender() {
        UUID user = UUID.randomUUID();
        when(bookshelfEntryRepository.findDistinctNovelIds()).thenReturn(List.of(novelId));
        when(novelRepository.findById(novelId)).thenReturn(Optional.of(novelWithChapters(1)));
        stubSupportedSite();
        when(ingestService.resolveNovel(any())).thenReturn(novelWithChapters(2));
        when(bookshelfEntryRepository.findUserIdsByNovelId(novelId)).thenReturn(List.of(user));
        when(readingPositionRepository.findByUserIdAndNovelId(user, novelId)).thenReturn(Optional.empty());
        when(pushDeviceService.tokensForUsers(List.of(user))).thenReturn(List.of(
                PushDeviceToken.builder().userId(user).platform(PushPlatform.ANDROID).token("good").build(),
                PushDeviceToken.builder().userId(user).platform(PushPlatform.ANDROID).token("dead").build()));
        when(pushSender.send(anyList(), any())).thenReturn(List.of("dead"));

        NovelUpdateNotifier.Summary summary = notifier.run();

        assertThat(summary.notified()).isEqualTo(1);
        verify(pushDeviceService).deleteTokens(List.of("dead"));
    }
}
