-- れいpay 初期スキーマ
-- アプリが最初に動いたときに自動で実行される（何度実行しても大丈夫なよう IF NOT EXISTS を付けている）。
-- 残高は users.balance に持ち、CHECK 制約でマイナスにならないことをデータベース側でも保証する。

-- 招待コードは1回だけ使える。使われたかどうかは users.invite_code から分かる。
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- handle: QRコードなどで相手を特定するための公開ID（ランダムな8文字）
-- invite_code: UNIQUE なので、同じ招待コードで2つ目のアカウントは作れない
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  invite_code TEXT UNIQUE REFERENCES invite_codes (code),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- Face ID などのパスキー。クッキーが消えたときの復元に使う。
CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  public_key_jwk TEXT NOT NULL,
  algorithm INTEGER NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys (user_id);

-- パスキーの登録・復元で使う、1回きりのチャレンジ（ランダムな値）
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  user_id INTEGER REFERENCES users (id),
  expires_at TEXT NOT NULL
);

-- 「支払う」画面のバーコード/QRコード。数分で期限切れになり、1回しか使えない。
CREATE TABLE IF NOT EXISTS payment_codes (
  code_hash TEXT PRIMARY KEY,
  payer_user_id INTEGER NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_codes_payer_user_id ON payment_codes (payer_user_id);

-- kind: 'grant' = はじめのプレゼント / 'issue' = 管理者が配る / 'transfer' = ユーザー同士
-- request_id: 同じ操作が二重に処理されないようにするための一意なID
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('grant', 'issue', 'transfer')),
  from_user_id INTEGER REFERENCES users (id),
  to_user_id INTEGER NOT NULL REFERENCES users (id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (kind IN ('grant', 'issue') AND from_user_id IS NULL)
    OR (kind = 'transfer' AND from_user_id IS NOT NULL AND from_user_id <> to_user_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_from_user_id ON transactions (from_user_id, id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user_id ON transactions (to_user_id, id);
