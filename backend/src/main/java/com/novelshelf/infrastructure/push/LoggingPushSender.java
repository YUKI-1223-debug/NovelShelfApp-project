package com.novelshelf.infrastructure.push;

import com.novelshelf.application.push.PushMessage;
import com.novelshelf.application.push.PushSender;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Firebase 未設定時のフォールバック。実際には送らず、送ろうとした内容をログに出すだけ
 * （ローカル開発・テスト用。無効トークンは無いものとして空リストを返す）。
 */
public class LoggingPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingPushSender.class);

    @Override
    public List<String> send(List<String> tokens, PushMessage message) {
        log.info("[push:noop] {} 件の端末へ送信予定: title=\"{}\" body=\"{}\" data={}",
                tokens.size(), message.title(), message.body(), message.data());
        return List.of();
    }
}
