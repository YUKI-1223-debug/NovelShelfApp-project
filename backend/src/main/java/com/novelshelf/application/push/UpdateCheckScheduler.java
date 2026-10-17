package com.novelshelf.application.push;

import java.time.Clock;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 更新通知ジョブ(NovelUpdateNotifier)を、決まった時刻(既定 8:00 と 19:00、Asia/Tokyo)に起動する。
 *
 * <p>以前は {@code @Scheduled(cron = ...)} を使っていたが、ミニPCは平日 1:00〜7:00 に休止する。Spring の
 * スケジューラは次の実行までの待ち時間を単調時計で数えるので、休止中はその時間が進まず、朝の実行が
 * 休止した時間の分(6 時間)遅れていた(2026-10 に 7:00 の実行が 13:00 になっているのをログで確認)。
 * そこで 1 分ごとに壁時計を見て、「実行時刻を過ぎていて、その回をまだ実行していない」ときだけ動かす。
 *
 * <p>起動した時点で既に過ぎている回は実行しない(再起動のたびに外部サイトへアクセスしないため)。
 */
@Component
public class UpdateCheckScheduler {

    private static final Logger log = LoggerFactory.getLogger(UpdateCheckScheduler.class);
    static final ZoneId ZONE = ZoneId.of("Asia/Tokyo");

    private final NovelUpdateNotifier notifier;
    private final Clock clock;
    private final List<LocalTime> times;
    /** 最後に処理した回の予定時刻。起動時は「直前の回」で初期化する。 */
    private ZonedDateTime lastHandledSlot;

    @Autowired
    public UpdateCheckScheduler(
            NovelUpdateNotifier notifier, @Value("${novelshelf.push.update-check-times:08:00,19:00}") String times) {
        this(notifier, Clock.system(ZONE), times);
    }

    UpdateCheckScheduler(NovelUpdateNotifier notifier, Clock clock, String times) {
        this.notifier = notifier;
        this.clock = clock;
        this.times = Arrays.stream(times.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(LocalTime::parse)
                .sorted()
                .toList();
        if (this.times.isEmpty()) {
            throw new IllegalArgumentException("novelshelf.push.update-check-times が空です");
        }
        this.lastHandledSlot = latestSlotAtOrBefore(now());
        log.info("更新通知ジョブの実行時刻: {} (Asia/Tokyo)", this.times);
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void tick() {
        ZonedDateTime due = latestSlotAtOrBefore(now());
        if (!due.isAfter(lastHandledSlot)) {
            return;
        }
        lastHandledSlot = due;
        log.info("更新通知ジョブを開始します (予定 {})", due.toLocalDateTime());
        notifier.scheduledRun();
    }

    private ZonedDateTime now() {
        return ZonedDateTime.now(clock).withZoneSameInstant(ZONE);
    }

    /** {@code now} 以前で一番新しい予定時刻(今日の分が無ければ前日の最後の回)。 */
    ZonedDateTime latestSlotAtOrBefore(ZonedDateTime now) {
        return times.stream()
                .map(t -> now.toLocalDate().atTime(t).atZone(ZONE))
                .filter(slot -> !slot.isAfter(now))
                .max(Comparator.naturalOrder())
                .orElseGet(() -> now.toLocalDate().minusDays(1).atTime(times.get(times.size() - 1)).atZone(ZONE));
    }
}
