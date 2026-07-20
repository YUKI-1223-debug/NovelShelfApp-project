-- shelfSortOrderはこれまでフロントエンドから一度も書き込まれたことがなく、初期値'UPDATED_DESC'の
-- まま放置されていた。本棚の並び替えUIを実装したのに合わせて意味の通る値に揃える。
UPDATE user_settings SET shelf_sort_order = 'ADDED_DESC' WHERE shelf_sort_order = 'UPDATED_DESC';
ALTER TABLE user_settings ALTER COLUMN shelf_sort_order SET DEFAULT 'ADDED_DESC';
