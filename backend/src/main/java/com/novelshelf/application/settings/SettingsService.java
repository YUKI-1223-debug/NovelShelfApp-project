package com.novelshelf.application.settings;

import com.novelshelf.domain.user.UserSettings;
import com.novelshelf.domain.user.UserSettingsRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final UserSettingsRepository userSettingsRepository;

    public SettingsService(UserSettingsRepository userSettingsRepository) {
        this.userSettingsRepository = userSettingsRepository;
    }

    @Transactional
    public UserSettings get(UUID userId) {
        return userSettingsRepository
                .findByUserId(userId)
                .orElseGet(() -> userSettingsRepository.save(
                        UserSettings.builder().userId(userId).build()));
    }

    @Transactional
    public UserSettings update(UUID userId, UserSettings incoming) {
        UserSettings current = get(userId);
        current.setDarkMode(incoming.isDarkMode());
        current.setWritingMode(incoming.getWritingMode());
        current.setFontFamily(incoming.getFontFamily());
        current.setFontSize(incoming.getFontSize());
        current.setLineHeight(incoming.getLineHeight());
        current.setMarginSize(incoming.getMarginSize());
        current.setBackgroundColor(incoming.getBackgroundColor());
        current.setTheme(incoming.getTheme());
        current.setPageMode(incoming.getPageMode());
        current.setShelfSortOrder(incoming.getShelfSortOrder());
        current.setUpdatedAt(Instant.now());
        return userSettingsRepository.save(current);
    }
}
