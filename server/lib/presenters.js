// 画面に返すユーザー情報の形。必要な項目だけを返し、内部の id などは出さない。

export function toPublicUser(user, { hasPasskey }) {
  return {
    handle: user.handle,
    displayName: user.displayName,
    balance: user.balance,
    isAdmin: user.isAdmin,
    hasPasskey,
  };
}

export function toUserSummary(user) {
  return { handle: user.handle, displayName: user.displayName };
}

export function toAdminUserView(user) {
  return {
    handle: user.handle,
    displayName: user.displayName,
    balance: user.balance,
    isAdmin: user.isAdmin,
  };
}
