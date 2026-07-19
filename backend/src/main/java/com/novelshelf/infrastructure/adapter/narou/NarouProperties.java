package com.novelshelf.infrastructure.adapter.narou;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "novelshelf.narou")
public record NarouProperties(
        String apiBaseUrl, String siteBaseUrl, long requestIntervalMs, String r18ApiBaseUrl, String r18SiteBaseUrl) {}
