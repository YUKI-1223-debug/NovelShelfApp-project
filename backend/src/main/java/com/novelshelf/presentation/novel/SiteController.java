package com.novelshelf.presentation.novel;

import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteCode;
import com.novelshelf.domain.novel.SiteRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class SiteController {

    private final SiteRepository siteRepository;

    public SiteController(SiteRepository siteRepository) {
        this.siteRepository = siteRepository;
    }

    public record SiteResponse(UUID id, SiteCode code, String name, boolean isSupported) {
        static SiteResponse from(Site site) {
            return new SiteResponse(site.getId(), site.getCode(), site.getName(), site.isSupported());
        }
    }

    @GetMapping
    public List<SiteResponse> list() {
        return siteRepository.findAll().stream().map(SiteResponse::from).toList();
    }
}
