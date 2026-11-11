// 画面をまたいで使う情報を1か所で持つ。

let currentUser = null;
let pendingCharge = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

// スキャンで読み取った相手の支払いコード（「受け取る金額」画面で使う）
export function getPendingCharge() {
  return pendingCharge;
}

export function setPendingCharge(charge) {
  pendingCharge = charge;
}
