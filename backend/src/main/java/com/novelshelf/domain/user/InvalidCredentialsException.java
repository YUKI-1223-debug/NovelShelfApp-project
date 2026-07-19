package com.novelshelf.domain.user;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("メールアドレスまたはパスワードが正しくありません。");
    }
}
