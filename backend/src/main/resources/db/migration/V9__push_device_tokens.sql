-- プッシュ通知の送信先デバイストークン。アプリ（Capacitor）起動時に登録し、ログアウト時に解除する。
-- 1トークン=1端末。FCM/APNs から「無効」と返ったトークンは送信処理側で自動削除する。
CREATE TABLE push_device_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform      VARCHAR(16) NOT NULL,           -- ANDROID / IOS
    token         VARCHAR(512) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_push_device_tokens_token UNIQUE (token)
);

CREATE INDEX idx_push_device_tokens_user ON push_device_tokens(user_id);
