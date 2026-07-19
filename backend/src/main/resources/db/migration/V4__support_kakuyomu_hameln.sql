-- KakuyomuAdapter/HamelnAdapter実装により本文取得に対応したため、is_supportedをtrueに更新する。
-- pixiv小説はガイドラインでクローラー等による作品収集を明確に禁止しているため対象外のまま
-- （リンク登録のみ、タイトルは手動編集。docs/DECISIONS.md参照）。
UPDATE sites SET is_supported = true WHERE code IN ('KAKUYOMU', 'HAMELN');
