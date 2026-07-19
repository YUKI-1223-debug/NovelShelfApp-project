package com.novelshelf.infrastructure.adapter.kakuyomu;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "novelshelf.kakuyomu")
public record KakuyomuProperties(String siteBaseUrl, long requestIntervalMs) {}
