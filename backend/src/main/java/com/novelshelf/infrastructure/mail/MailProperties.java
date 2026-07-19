package com.novelshelf.infrastructure.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "novelshelf.mail")
public record MailProperties(String from, long resetTokenTtlMinutes, String frontendBaseUrl) {}
