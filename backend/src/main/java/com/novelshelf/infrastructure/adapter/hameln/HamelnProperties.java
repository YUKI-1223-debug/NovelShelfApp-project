package com.novelshelf.infrastructure.adapter.hameln;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "novelshelf.hameln")
public record HamelnProperties(String siteBaseUrl, String r18SiteBaseUrl, long requestIntervalMs) {}
