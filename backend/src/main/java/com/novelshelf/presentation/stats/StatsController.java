package com.novelshelf.presentation.stats;

import com.novelshelf.application.stats.BreakdownDimension;
import com.novelshelf.application.stats.BreakdownItem;
import com.novelshelf.application.stats.CalendarDay;
import com.novelshelf.application.stats.StatsRange;
import com.novelshelf.application.stats.StatsService;
import com.novelshelf.application.stats.StatsSummary;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/summary")
    public StatsSummary summary(@AuthenticationPrincipal UUID userId) {
        return statsService.summary(userId);
    }

    @GetMapping("/breakdown")
    public List<BreakdownItem> breakdown(
            @RequestParam String by,
            @RequestParam(required = false) String range,
            @AuthenticationPrincipal UUID userId) {
        BreakdownDimension dimension = BreakdownDimension.valueOf(by.toUpperCase());
        StatsRange statsRange = range != null ? StatsRange.valueOf(range.toUpperCase()) : StatsRange.ALL;
        return statsService.breakdown(userId, dimension, statsRange);
    }

    @GetMapping("/calendar")
    public List<CalendarDay> calendar(@RequestParam String yearMonth, @AuthenticationPrincipal UUID userId) {
        return statsService.calendar(userId, YearMonth.parse(yearMonth));
    }
}
