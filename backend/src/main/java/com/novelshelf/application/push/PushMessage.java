package com.novelshelf.application.push;

import java.util.Map;

/**
 * プッシュ通知1件の内容。data はタップ時のディープリンク用（例: novelId）にアプリへ渡される。
 */
public record PushMessage(String title, String body, Map<String, String> data) {}
