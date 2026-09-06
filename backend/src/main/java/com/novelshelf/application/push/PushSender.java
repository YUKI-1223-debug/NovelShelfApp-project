package com.novelshelf.application.push;

import java.util.List;

/**
 * プッシュ通知の実際の配信手段（FCM/APNs 等）を抽象化する。
 * 実装は {@code infrastructure.push} に置く。
 */
public interface PushSender {

    /**
     * 指定トークン群へ同一メッセージを送る。
     *
     * @return 配信不能（登録解除済み・不正）と判明したトークン。呼び出し側がDBから削除する。
     */
    List<String> send(List<String> tokens, PushMessage message);
}
