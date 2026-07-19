package com.novelshelf.domain.user;

public class EmailAlreadyExistsException extends RuntimeException {
    public EmailAlreadyExistsException(String email) {
        super("このメールアドレスは既に登録されています: " + email);
    }
}
