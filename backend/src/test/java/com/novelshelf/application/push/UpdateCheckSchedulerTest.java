package com.novelshelf.application.push;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 休止(平日 1:00〜7:00)をまたいでも、8:00 / 19:00 に遅れず1回ずつ動くこと。 */
class UpdateCheckSchedulerTest {

    /** テストから時刻を進められる時計。 */
    static class MutableClock extends Clock {
        private Instant now;

        MutableClock(LocalDateTime start) {
            this.now = start.atZone(UpdateCheckScheduler.ZONE).toInstant();
        }

        void set(LocalDateTime t) {
            now = t.atZone(UpdateCheckScheduler.ZONE).toInstant();
        }

        @Override
        public ZoneId getZone() {
            return UpdateCheckScheduler.ZONE;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    NovelUpdateNotifier notifier;

    @BeforeEach
    void setUp() {
        notifier = mock(NovelUpdateNotifier.class);
    }

    @Test
    void runsAtEightAfterResumingFromSleep() {
        // 月曜 0:30 に起動 → 1:00〜7:00 休止(時計だけが進む) → 7:00 復帰
        MutableClock clock = new MutableClock(LocalDateTime.of(2026, 10, 19, 0, 30));
        UpdateCheckScheduler scheduler = new UpdateCheckScheduler(notifier, clock, "08:00,19:00");

        clock.set(LocalDateTime.of(2026, 10, 19, 7, 1));
        scheduler.tick();
        verify(notifier, never()).scheduledRun();

        clock.set(LocalDateTime.of(2026, 10, 19, 8, 0));
        scheduler.tick();
        verify(notifier, times(1)).scheduledRun();
    }

    @Test
    void runsOncePerSlotEvenIfTickedRepeatedly() {
        MutableClock clock = new MutableClock(LocalDateTime.of(2026, 10, 19, 7, 59));
        UpdateCheckScheduler scheduler = new UpdateCheckScheduler(notifier, clock, "08:00,19:00");

        clock.set(LocalDateTime.of(2026, 10, 19, 8, 0, 30));
        scheduler.tick();
        clock.set(LocalDateTime.of(2026, 10, 19, 8, 1, 30));
        scheduler.tick();
        clock.set(LocalDateTime.of(2026, 10, 19, 18, 59));
        scheduler.tick();
        verify(notifier, times(1)).scheduledRun();

        clock.set(LocalDateTime.of(2026, 10, 19, 19, 0, 10));
        scheduler.tick();
        verify(notifier, times(2)).scheduledRun();
    }

    @Test
    void doesNotRunSlotsThatHadPassedBeforeStartup() {
        // 8:30 に再起動しても、その日の 8:00 の分はやり直さない
        MutableClock clock = new MutableClock(LocalDateTime.of(2026, 10, 19, 8, 30));
        UpdateCheckScheduler scheduler = new UpdateCheckScheduler(notifier, clock, "08:00,19:00");

        scheduler.tick();
        verify(notifier, never()).scheduledRun();
    }

    @Test
    void missedSlotDuringLongPauseRunsOnlyOnce() {
        // 7:50 に止まり、10:00 に動き出した(8:00 を寝過ごした)→ 1回だけ実行する
        MutableClock clock = new MutableClock(LocalDateTime.of(2026, 10, 19, 7, 50));
        UpdateCheckScheduler scheduler = new UpdateCheckScheduler(notifier, clock, "08:00,19:00");

        clock.set(LocalDateTime.of(2026, 10, 19, 10, 0));
        scheduler.tick();
        scheduler.tick();
        verify(notifier, times(1)).scheduledRun();
    }

    @Test
    void crossesMidnight() {
        // 19:00 の分を済ませたあと、翌朝 8:00 に動く
        MutableClock clock = new MutableClock(LocalDateTime.of(2026, 10, 19, 19, 30));
        UpdateCheckScheduler scheduler = new UpdateCheckScheduler(notifier, clock, "08:00,19:00");

        clock.set(LocalDateTime.of(2026, 10, 20, 0, 5));
        scheduler.tick();
        verify(notifier, never()).scheduledRun();

        clock.set(LocalDateTime.of(2026, 10, 20, 8, 0));
        scheduler.tick();
        verify(notifier, times(1)).scheduledRun();
    }
}
