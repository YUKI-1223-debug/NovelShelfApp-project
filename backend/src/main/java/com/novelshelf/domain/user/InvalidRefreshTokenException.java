package com.novelshelf.domain.user;

public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException() {
        super("リフレッシュトークンが無効です。再度ログインしてください。");
    }
}
