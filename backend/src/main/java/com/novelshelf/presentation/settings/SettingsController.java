package com.novelshelf.presentation.settings;

import com.novelshelf.application.settings.SettingsService;
import com.novelshelf.domain.user.FontFamily;
import com.novelshelf.domain.user.PageMode;
import com.novelshelf.domain.user.PageTurnGesture;
import com.novelshelf.domain.user.UserSettings;
import com.novelshelf.domain.user.WritingMode;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    public record UserSettingsDto(
            boolean darkMode,
            WritingMode writingMode,
            FontFamily fontFamily,
            int fontSize,
            float lineHeight,
            String marginSize,
            String backgroundColor,
            String theme,
            PageMode pageMode,
            String shelfSortOrder,
            PageTurnGesture pageTurnGesture) {
        static UserSettingsDto from(UserSettings s) {
            return new UserSettingsDto(
                    s.isDarkMode(),
                    s.getWritingMode(),
                    s.getFontFamily(),
                    s.getFontSize(),
                    s.getLineHeight(),
                    s.getMarginSize(),
                    s.getBackgroundColor(),
                    s.getTheme(),
                    s.getPageMode(),
                    s.getShelfSortOrder(),
                    s.getPageTurnGesture());
        }

        UserSettings toEntity() {
            return UserSettings.builder()
                    .darkMode(darkMode)
                    .writingMode(writingMode)
                    .fontFamily(fontFamily)
                    .fontSize(fontSize)
                    .lineHeight(lineHeight)
                    .marginSize(marginSize)
                    .backgroundColor(backgroundColor)
                    .theme(theme)
                    .pageMode(pageMode)
                    .shelfSortOrder(shelfSortOrder)
                    .pageTurnGesture(pageTurnGesture)
                    .build();
        }
    }

    @GetMapping
    public UserSettingsDto get(@AuthenticationPrincipal UUID userId) {
        return UserSettingsDto.from(settingsService.get(userId));
    }

    @PutMapping
    public UserSettingsDto update(@RequestBody UserSettingsDto request, @AuthenticationPrincipal UUID userId) {
        return UserSettingsDto.from(settingsService.update(userId, request.toEntity()));
    }
}
