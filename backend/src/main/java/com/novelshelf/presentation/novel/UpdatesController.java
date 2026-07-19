package com.novelshelf.presentation.novel;

import com.novelshelf.application.novel.UpdateService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/updates")
public class UpdatesController {

    private final UpdateService updateService;
    private final NovelResponseMapper mapper;

    public UpdatesController(UpdateService updateService, NovelResponseMapper mapper) {
        this.updateService = updateService;
        this.mapper = mapper;
    }

    @GetMapping
    public List<NovelResponse> list(@AuthenticationPrincipal UUID userId) {
        return updateService.listUpdated(userId).stream().map(n -> mapper.toResponse(n, userId)).toList();
    }

    @PostMapping("/check")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void check(@AuthenticationPrincipal UUID userId) {
        updateService.checkUpdatesAsync(userId);
    }
}
