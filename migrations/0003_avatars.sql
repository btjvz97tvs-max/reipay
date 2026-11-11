-- 自分のアイコン画像。
-- 画像そのものは avatars 表に置き、users には更新日時だけを持つ。
-- 更新日時を画像のURLに付けることで、アイコンを変えたときに新しい画像が読み込まれる。

ALTER TABLE users ADD COLUMN avatar_updated_at TEXT;

CREATE TABLE avatars (
  user_id INTEGER PRIMARY KEY REFERENCES users (id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_base64 TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
