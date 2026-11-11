// サーバー全体で使う設定値。数値を変えたいときはこのファイルだけを編集する。

export const SESSION_COOKIE_NAME = '__Host-reipay_session';
// ブラウザが受け付けるクッキーの最長期間（400日）。アプリを開くたびに延長する。
export const SESSION_TTL_DAYS = 400;

export const WELCOME_BONUS = 2000;
export const CURRENCY_UNIT = 'れい';

export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 1000000;
export const MEMO_MAX_LENGTH = 50;
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const HISTORY_LIMIT = 50;

export const PAYMENT_CODE_TTL_MINUTES = 5;
export const WEBAUTHN_CHALLENGE_TTL_MINUTES = 5;
export const WEBAUTHN_RP_NAME = 'れいpay';

export const REQUEST_BODY_MAX_BYTES = 20000;

// アイコン画像（画面側で小さな正方形にしてから送る）
export const AVATAR_MAX_BYTES = 100000;
export const AVATAR_REQUEST_MAX_BYTES = 160000;
