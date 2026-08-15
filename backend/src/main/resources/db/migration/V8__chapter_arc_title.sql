-- サイト側で話が「章」単位にグループ分けされている場合の章題（なろうのp-eplist__chapter-title、
-- カクヨムのTableOfContentsChapter.chapter.title等）を保存する。章分けが無い作品・サイトではNULL。
ALTER TABLE chapters ADD COLUMN arc_title VARCHAR(500);
