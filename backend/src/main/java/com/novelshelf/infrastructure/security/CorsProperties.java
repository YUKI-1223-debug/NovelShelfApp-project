package com.novelshelf.infrastructure.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "novelshelf.cors")
public record CorsProperties(List<String> allowedOrigins) {}
