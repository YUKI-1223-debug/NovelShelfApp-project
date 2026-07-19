package com.novelshelf.application.auth;

public record TokenPair(String accessToken, String refreshToken, long expiresInSeconds) {}
