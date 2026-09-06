package com.novelshelf.application.push;

import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelRepository;
import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteRepository;
import com.novelshelf.domain.push.PushDeviceToken;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import com.novelshelf.application.novel.IngestService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 本棚にある全作品を定期的に再取得し、話数が増えた作品について「まだ読み切っていない」利用者の
 * 端末へプッシュ通知を送る。
 *
 * <p>外部サイトへのアクセス頻度は各サイトアダプタのレートリミッタ（全体1req/秒）と
 * ジョブ間隔（{@code novelshelf.push.update-check-cron}、既定1日2回）で抑える。
 * 「必要な分だけ間隔を空けて取得する」方針（docs/DECISIONS.md）を維持すること。
 */
@Component
public class NovelUpdateNotifier {

    private static final Logger log = LoggerFactory.getLogger(NovelUpdateNotifier.class);

    private final BookshelfEntryRepository bookshelfEntryRepository;
    private final NovelRepository novelRepository;
    private final SiteRepository siteRepository;
    private final ReadingPositionRepository readingPositionRepository;
    private final IngestService ingestService;
    private final PushDeviceService pushDeviceService;
    private final PushSender pushSender;

    public NovelUpdateNotifier(
            BookshelfEntryRepository bookshelfEntryRepository,
            NovelRepository novelRepository,
            SiteRepository siteRepository,
            ReadingPositionRepository readingPositionRepository,
            IngestService ingestService,
            PushDeviceService pushDeviceService,
            PushSender pushSender) {
        this.bookshelfEntryRepository = bookshelfEntryRepository;
        this.novelRepository = novelRepository;
        this.siteRepository = siteRepository;
        this.readingPositionRepository = readingPositionRepository;
        this.ingestService = ingestService;
        this.pushDeviceService = pushDeviceService;
        this.pushSender = pushSender;
    }

    @Scheduled(cron = "${novelshelf.push.update-check-cron:0 0 7,19 * * *}", zone = "Asia/Tokyo")
    public void scheduledRun() {
        Summary summary = run();
        log.info("更新通知ジョブ完了: 対象{} / 更新あり{} / 通知送信{}件",
                summary.checked(), summary.updated(), summary.notified());
    }

    /** 1周分の処理。手動トリガー（{@code POST /api/v1/push/run-update-check}）からも呼ばれる。 */
    public Summary run() {
        List<UUID> novelIds = bookshelfEntryRepository.findDistinctNovelIds();
        int checked = 0;
        int updated = 0;
        int notified = 0;

        for (UUID novelId : novelIds) {
            Novel before = novelRepository.findById(novelId).orElse(null);
            if (before == null) {
                continue;
            }
            Site site = siteRepository.findById(before.getSiteId()).orElse(null);
            if (site == null || !site.isSupported()) {
                continue; // リンク登録のみの作品は取得対象外
            }

            int previousLatest = before.getLatestKnownChapterNo();
            Novel after;
            try {
                after = ingestService.resolveNovel(before.getSourceUrl());
                checked++;
            } catch (RuntimeException e) {
                log.warn("更新確認に失敗しました: novelId={}, reason={}", novelId, e.getMessage());
                continue;
            }

            if (after.getLatestKnownChapterNo() <= previousLatest) {
                continue;
            }
            updated++;
            notified += notifyForUpdatedNovel(after);
        }
        return new Summary(checked, updated, notified);
    }

    private int notifyForUpdatedNovel(Novel novel) {
        List<UUID> targetUserIds = bookshelfEntryRepository.findUserIdsByNovelId(novel.getId()).stream()
                .filter(userId -> !isCaughtUp(userId, novel))
                .toList();

        List<PushDeviceToken> tokens = pushDeviceService.tokensForUsers(targetUserIds);
        if (tokens.isEmpty()) {
            return 0;
        }

        PushMessage message = new PushMessage(
                novel.getTitle(),
                "新しい話が公開されました（第" + novel.getLatestKnownChapterNo() + "話まで）",
                Map.of("type", "novel_update", "novelId", novel.getId().toString()));

        List<String> tokenStrings = tokens.stream().map(PushDeviceToken::getToken).toList();
        List<String> dead = pushSender.send(tokenStrings, message);
        pushDeviceService.deleteTokens(dead);
        return tokenStrings.size() - dead.size();
    }

    /** その利用者が既に最新話まで読み終えているか（読書位置が無ければ「未読」＝通知対象）。 */
    private boolean isCaughtUp(UUID userId, Novel novel) {
        return readingPositionRepository
                .findByUserIdAndNovelId(userId, novel.getId())
                .map(position -> position.getLastReadChapterNo() >= novel.getLatestKnownChapterNo())
                .orElse(false);
    }

    public record Summary(int checked, int updated, int notified) {}
}
