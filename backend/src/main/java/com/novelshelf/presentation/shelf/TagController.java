package com.novelshelf.presentation.shelf;

import com.novelshelf.application.shelf.TagService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    public record CreateTagRequest(@NotBlank String name) {}

    @GetMapping
    public List<TagResponse> list(@AuthenticationPrincipal UUID userId) {
        return tagService.listByUser(userId).stream().map(TagResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TagResponse create(@Valid @RequestBody CreateTagRequest request, @AuthenticationPrincipal UUID userId) {
        return TagResponse.from(tagService.getOrCreate(userId, request.name()));
    }
}
