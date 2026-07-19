package com.novelshelf.domain.user;

public class InvalidPasswordResetTokenException extends RuntimeException {
    public InvalidPasswordResetTokenException() {
        super("パスワード再設定リンクが無効か、有効期限が切れています。もう一度お試しください。");
    }
}
