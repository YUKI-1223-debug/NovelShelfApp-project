package com.novelshelf.presentation.offline;

import com.novelshelf.application.offline.OfflineService;
import com.novelshelf.domain.offline.OfflineSavePreference;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/offline/preferences")
public class OfflineController {

    private final OfflineService offlineService;

    public OfflineController(OfflineService offlineService) {
        this.offlineService = offlineService;
    }

    public record OfflineSaveRequest(@NotNull UUID chapterId) {}

    public record OfflineSavePreferenceResponse(UUID chapterId, boolean autoCached, Instant requestedAt) {
        static OfflineSavePreferenceResponse from(OfflineSavePreference p) {
            return new OfflineSavePreferenceResponse(p.getChapterId(), p.isAutoCached(), p.getRequestedAt());
        }
    }

    @GetMapping
    public List<OfflineSavePreferenceResponse> list(@AuthenticationPrincipal UUID userId) {
        return offlineService.list(userId).stream().map(OfflineSavePreferenceResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OfflineSavePreferenceResponse add(
            @Valid @RequestBody OfflineSaveRequest request, @AuthenticationPrincipal UUID userId) {
        return OfflineSavePreferenceResponse.from(offlineService.add(userId, request.chapterId()));
    }

    @DeleteMapping("/{chapterId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID chapterId, @AuthenticationPrincipal UUID userId) {
        offlineService.remove(userId, chapterId);
    }
}
