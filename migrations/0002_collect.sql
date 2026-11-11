-- 管理者の「回収」を記録できるよう、transactions の kind に 'collect' を追加する。
-- 回収は「相手の残高から引いて消す」だけなので、受け取る人（to_user_id）はいない。
-- SQLite は CHECK 制約をあとから変えられないため、表を作り直してデータを移す。

CREATE TABLE transactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('grant', 'issue', 'transfer', 'collect')),
  from_user_id INTEGER REFERENCES users (id),
  to_user_id INTEGER REFERENCES users (id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (kind IN ('grant', 'issue') AND from_user_id IS NULL AND to_user_id IS NOT NULL)
    OR (kind = 'collect' AND from_user_id IS NOT NULL AND to_user_id IS NULL)
    OR (
      kind = 'transfer'
      AND from_user_id IS NOT NULL
      AND to_user_id IS NOT NULL
      AND from_user_id <> to_user_id
    )
  )
);

INSERT INTO transactions_new (id, request_id, kind, from_user_id, to_user_id, amount, memo, created_at)
SELECT id, request_id, kind, from_user_id, to_user_id, amount, memo, created_at FROM transactions;

DROP TABLE transactions;

ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX idx_transactions_from_user_id ON transactions (from_user_id, id);
CREATE INDEX idx_transactions_to_user_id ON transactions (to_user_id, id);
